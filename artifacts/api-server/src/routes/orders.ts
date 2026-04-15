import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { ordersTable, orderItemsTable, tablesTable, menuItemsTable, tableSessionsTable, customersTable, inventoryItemsTable } from "@workspace/db";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import type { JwtPayload } from "../lib/auth";
import { createNotification } from "../lib/notifications";

const VALID_STATUSES = ["pending", "confirmed", "preparing", "ready", "served", "paid", "cancelled"] as const;
type OrderStatus = (typeof VALID_STATUSES)[number];

// Valid status transitions: from -> allowed to states
const STATUS_TRANSITIONS: Record<string, OrderStatus[]> = {
  pending: ["confirmed", "preparing", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served", "paid", "cancelled"],
  served: ["paid"],
  paid: [],
  cancelled: [],
};
import type { Server as SocketIOServer } from "socket.io";

const router = Router();

async function getOrderWithItems(orderId: number) {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) return null;

  const [table] = await db.select().from(tablesTable).where(eq(tablesTable.id, order.tableId));
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));

  return {
    ...order,
    tableName: table?.name ?? "",
    totalAmount: Number(order.totalAmount),
    discount: Number(order.discount),
    paymentMethod: order.paymentMethod ?? "cash",
    items: items.map((i) => ({
      ...i,
      unitPrice: Number(i.unitPrice),
    })),
  };
}

router.get("/orders", requireAuth, async (req, res) => {
  try {
    const { status, tableId } = req.query as { status?: string; tableId?: string };

    let query = db.select().from(ordersTable).$dynamic();

    const conditions = [];
    if (status) {
      conditions.push(eq(ordersTable.status, status as "pending" | "confirmed" | "preparing" | "ready" | "served" | "paid" | "cancelled"));
    }
    if (tableId) {
      conditions.push(eq(ordersTable.tableId, parseInt(tableId)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const orders = await query.orderBy(ordersTable.createdAt);

    const tableIds = [...new Set(orders.map((o) => o.tableId))];
    const tables = tableIds.length > 0 ? await db.select().from(tablesTable).where(inArray(tablesTable.id, tableIds)) : [];
    const tableMap = new Map(tables.map((t) => [t.id, t]));

    const orderIds = orders.map((o) => o.id);
    const allItems = orderIds.length > 0 ? await db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds)) : [];

    const result = orders.map((order) => ({
      ...order,
      tableName: tableMap.get(order.tableId)?.name ?? "",
      totalAmount: Number(order.totalAmount),
      discount: Number(order.discount),
      paymentMethod: order.paymentMethod ?? "cash",
      items: allItems
        .filter((i) => i.orderId === order.id)
        .map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.post("/orders", async (req, res) => {
  try {
    const { tableToken, customerId, items, notes, paymentMethod } = req.body as {
      tableToken: string;
      customerId?: string;
      items: Array<{ menuItemId: number; quantity: number; notes?: string }>;
      notes?: string;
      paymentMethod?: "cash" | "bank";
    };

    if (!tableToken || !items?.length) {
      res.status(400).json({ error: "bad_request", message: "tableToken and items required" });
      return;
    }

    if (!customerId) {
      res.status(400).json({ error: "bad_request", message: "customerId required" });
      return;
    }

    // Validate quantities
    for (const item of items) {
      if (!item.quantity || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
        res.status(400).json({ error: "validation_error", message: "Тоо ширхэг нь 1-ээс их бүхэл тоо байх ёстой" });
        return;
      }
    }

    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));
    if (!customer) {
      res.status(401).json({ error: "invalid_customer", message: "Зочны бүртгэл олдсонгүй" });
      return;
    }

    const [table] = await db.select().from(tablesTable).where(eq(tablesTable.qrToken, tableToken));
    if (!table) {
      res.status(401).json({ error: "invalid_session", message: "Invalid table session" });
      return;
    }

    // QR session security: only allow ordering when table is occupied (activated by staff)
    if (table.status === "available") {
      res.status(403).json({ error: "table_not_active", message: "Ширээ идэвхжээгүй байна. Үйлчлэгчид хандана уу." });
      return;
    }

    // An open session must exist (staff activated the table).
    // Multiple guests sharing the same table may all order on the same
    // active session — we do not require the session's creator customerId
    // to match this order's customerId.
    const [openSession] = await db
      .select()
      .from(tableSessionsTable)
      .where(and(eq(tableSessionsTable.tableId, table.id), isNull(tableSessionsTable.endedAt)));

    if (!openSession) {
      res.status(403).json({ error: "no_session", message: "Идэвхтэй session байхгүй байна" });
      return;
    }

    const menuItemIds = items.map((i) => i.menuItemId);
    const menuItems = await db.select().from(menuItemsTable).where(inArray(menuItemsTable.id, menuItemIds));
    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    let newTotal = 0;
    const orderItemsData = items.map((item) => {
      const menuItem = menuItemMap.get(item.menuItemId);
      if (!menuItem) throw new Error(`Menu item ${item.menuItemId} not found`);
      const lineTotal = Number(menuItem.price) * item.quantity;
      newTotal += lineTotal;
      return {
        menuItemId: item.menuItemId,
        menuItemName: menuItem.name,
        quantity: item.quantity,
        unitPrice: menuItem.price,
        notes: item.notes ?? null,
      };
    });

    const method = paymentMethod ?? "cash";

    // Only merge with the same guest's most recent active order within 10
    // minutes so each guest at a shared table keeps their own ticket.
    const activeStatuses = ["pending", "confirmed", "preparing"] as const;
    const existingOrders = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.tableId, table.id),
          eq(ordersTable.customerId, customerId),
          inArray(ordersTable.status, [...activeStatuses]),
        )
      )
      .orderBy(ordersTable.createdAt);

    const MERGE_WINDOW_MS = 10 * 60 * 1000;
    const mostRecent = existingOrders[existingOrders.length - 1];
    const withinMergeWindow =
      !!mostRecent &&
      Date.now() - new Date(mostRecent.createdAt).getTime() < MERGE_WINDOW_MS;

    let orderId: number;

    if (withinMergeWindow && mostRecent) {
      // Append items to the most recent active order
      const existingOrder = mostRecent;
      orderId = existingOrder.id;

      // Get existing items to merge quantities for same menu items
      const existingItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
      const existingItemMap = new Map(existingItems.map((i) => [i.menuItemId, i]));

      for (const newItem of orderItemsData) {
        const existing = existingItemMap.get(newItem.menuItemId);
        if (existing) {
          // Same menu item exists - increase quantity
          await db
            .update(orderItemsTable)
            .set({ quantity: existing.quantity + newItem.quantity })
            .where(eq(orderItemsTable.id, existing.id));
        } else {
          // New menu item - insert
          await db.insert(orderItemsTable).values({ ...newItem, orderId });
        }
      }

      // Recalculate total
      const allItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
      const recalcTotal = allItems.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
      await db
        .update(ordersTable)
        .set({ totalAmount: String(recalcTotal), updatedAt: new Date() })
        .where(eq(ordersTable.id, orderId));
    } else {
      // No active order - create new one
      const [order] = await db
        .insert(ordersTable)
        .values({
          tableId: table.id,
          tableToken,
          customerId,
          sessionId: openSession.id,
          totalAmount: String(newTotal),
          notes: notes ?? null,
          paymentMethod: method,
        })
        .returning();
      orderId = order.id;
      await db.insert(orderItemsTable).values(orderItemsData.map((i) => ({ ...i, orderId })));
    }

    // Auto-decrement inventory for menu items linked to inventory_items.
    // Aggregate quantities per inventory item first so one order with the
    // same item in multiple lines only produces one delta.
    const invDeltas = new Map<number, number>();
    for (const item of items) {
      const menuItem = menuItemMap.get(item.menuItemId);
      if (!menuItem?.inventoryItemId) continue;
      invDeltas.set(menuItem.inventoryItemId, (invDeltas.get(menuItem.inventoryItemId) ?? 0) + item.quantity);
    }

    for (const [invId, delta] of invDeltas.entries()) {
      const [prev] = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.id, invId));
      if (!prev) continue;
      const newQty = Math.max(prev.quantity - delta, 0);
      await db
        .update(inventoryItemsTable)
        .set({ quantity: newQty, updatedAt: new Date() })
        .where(eq(inventoryItemsTable.id, invId));

      // Fire a notification only when the stock crosses below threshold,
      // or drops to zero — so we don't spam one notification per order
      // while the stock is already low.
      const crossedThreshold = prev.quantity > prev.threshold && newQty <= prev.threshold;
      const becameEmpty = prev.quantity > 0 && newQty === 0;
      if (crossedThreshold || becameEmpty) {
        const io: SocketIOServer = req.app.get("io");
        await createNotification(io, {
          type: "inventory_low",
          title: newQty === 0 ? "Нөөц дууслаа" : "Нөөц дуусах гэж байна",
          message: `"${prev.name}" — ${newQty} ш үлдсэн (доод хэмжээ: ${prev.threshold})`,
          data: { inventoryItemId: prev.id },
        });
      }
    }

    const fullOrder = await getOrderWithItems(orderId);

    const io: SocketIOServer = req.app.get("io");
    if (withinMergeWindow) {
      io.to(`restaurant_1`).emit("order:updated", fullOrder);
    } else {
      io.to(`restaurant_1`).emit("order:new", fullOrder);
      await createNotification(io, {
        type: "order_new",
        title: "Шинэ захиалга",
        message: `Ширээ ${fullOrder?.tableName ?? "#" + table.id} — ₮${Number(fullOrder?.totalAmount ?? 0).toLocaleString()}`,
        data: { orderId, tableId: table.id },
      });
    }
    io.to(`session_${tableToken}`).emit("order:updated", fullOrder);

    // Keep table occupied (staff already activated it)
    if (table.status !== "occupied") {
      await db.update(tablesTable).set({ status: "occupied", occupiedSince: new Date() }).where(eq(tablesTable.id, table.id));
    }

    res.status(withinMergeWindow ? 200 : 201).json(fullOrder);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.get("/orders/:orderId", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId as string);
    const order = await getOrderWithItems(orderId);
    if (!order) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.patch("/orders/:orderId/status", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId as string);
    const { status } = req.body as { status: string };

    // Validate status value
    if (!VALID_STATUSES.includes(status as OrderStatus)) {
      res.status(400).json({ error: "validation_error", message: `Буруу статус: ${status}` });
      return;
    }

    // Check current status and validate transition
    const [currentOrder] = await db.select({ status: ordersTable.status }).from(ordersTable).where(eq(ordersTable.id, orderId));
    if (!currentOrder) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const allowed = STATUS_TRANSITIONS[currentOrder.status];
    if (allowed && !allowed.includes(status as OrderStatus)) {
      res.status(400).json({
        error: "invalid_transition",
        message: `"${currentOrder.status}" статусаас "${status}" руу шилжих боломжгүй`,
      });
      return;
    }

    const updateData: Record<string, unknown> = { status: status as OrderStatus, updatedAt: new Date() };

    // Track timestamps for specific transitions
    if (status === "preparing") updateData.printedAt = new Date();
    if (status === "paid") updateData.paidAt = new Date();

    const [updated] = await db
      .update(ordersTable)
      .set(updateData)
      .where(eq(ordersTable.id, orderId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const fullOrder = await getOrderWithItems(orderId);

    const io: SocketIOServer = req.app.get("io");
    io.to(`restaurant_1`).emit("order:updated", fullOrder);
    io.to(`session_${updated.tableToken}`).emit("order:updated", fullOrder);

    if (status === "paid") {
      const activeOrders = await db
        .select()
        .from(ordersTable)
        .where(and(eq(ordersTable.tableId, updated.tableId)));

      const allPaidOrCancelled = activeOrders.every(
        (o) => o.id === orderId || o.status === "paid" || o.status === "cancelled"
      );
      if (allPaidOrCancelled) {
        const newToken = (await import("uuid")).v4();
        await db
          .update(tablesTable)
          .set({ status: "available", occupiedSince: null, qrToken: newToken })
          .where(eq(tablesTable.id, updated.tableId));
        await db
          .update(tableSessionsTable)
          .set({ endedAt: new Date() })
          .where(and(eq(tableSessionsTable.tableId, updated.tableId), isNull(tableSessionsTable.endedAt)));
      }
    }

    res.json(fullOrder);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

// Remove an item from order (void)
router.delete("/orders/:orderId/items/:itemId", requireAuth, requireRole("manager", "cashier"), async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId as string);
    const itemId = parseInt(req.params.itemId as string);

    // Check order exists and is not paid/cancelled
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (!order) { res.status(404).json({ error: "not_found" }); return; }
    if (order.status === "paid" || order.status === "cancelled") {
      res.status(400).json({ error: "invalid_action", message: "Дууссан захиалгаас хоол хасах боломжгүй" });
      return;
    }

    // Delete the item
    const [deleted] = await db.delete(orderItemsTable)
      .where(and(eq(orderItemsTable.id, itemId), eq(orderItemsTable.orderId, orderId)))
      .returning();
    if (!deleted) { res.status(404).json({ error: "not_found", message: "Хоол олдсонгүй" }); return; }

    // Recalculate total
    const remaining = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
    const newTotal = remaining.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
    await db.update(ordersTable).set({ totalAmount: String(newTotal), updatedAt: new Date() }).where(eq(ordersTable.id, orderId));

    const fullOrder = await getOrderWithItems(orderId);
    const io: SocketIOServer = req.app.get("io");
    io.to(`restaurant_1`).emit("order:updated", fullOrder);
    io.to(`session_${order.tableToken}`).emit("order:updated", fullOrder);

    res.json(fullOrder);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.get("/orders/table/:tableToken", async (req, res) => {
  try {
    const { tableToken } = req.params as { tableToken: string };
    const orders = await db.select().from(ordersTable).where(eq(ordersTable.tableToken, tableToken)).orderBy(ordersTable.createdAt);

    const orderIds = orders.map((o) => o.id);
    const allItems = orderIds.length > 0 ? await db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds)) : [];

    const [table] = orders.length > 0 ? await db.select().from(tablesTable).where(eq(tablesTable.id, orders[0]!.tableId)) : [undefined];

    const result = orders.map((order) => ({
      ...order,
      tableName: table?.name ?? "",
      totalAmount: Number(order.totalAmount),
      discount: Number(order.discount),
      paymentMethod: order.paymentMethod ?? "cash",
      items: allItems
        .filter((i) => i.orderId === order.id)
        .map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

export default router;
