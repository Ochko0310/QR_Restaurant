import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { ordersTable, orderItemsTable, tablesTable, menuItemsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import type { JwtPayload } from "../lib/auth";
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
    const { tableToken, items, notes } = req.body as {
      tableToken: string;
      items: Array<{ menuItemId: number; quantity: number; notes?: string }>;
      notes?: string;
    };

    if (!tableToken || !items?.length) {
      res.status(400).json({ error: "bad_request", message: "tableToken and items required" });
      return;
    }

    const [table] = await db.select().from(tablesTable).where(eq(tablesTable.qrToken, tableToken));
    if (!table) {
      res.status(401).json({ error: "invalid_session", message: "Invalid table session" });
      return;
    }

    const menuItemIds = items.map((i) => i.menuItemId);
    const menuItems = await db.select().from(menuItemsTable).where(inArray(menuItemsTable.id, menuItemIds));
    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    let total = 0;
    const orderItemsData = items.map((item) => {
      const menuItem = menuItemMap.get(item.menuItemId);
      if (!menuItem) throw new Error(`Menu item ${item.menuItemId} not found`);
      const lineTotal = Number(menuItem.price) * item.quantity;
      total += lineTotal;
      return {
        menuItemId: item.menuItemId,
        menuItemName: menuItem.name,
        quantity: item.quantity,
        unitPrice: menuItem.price,
        notes: item.notes ?? null,
      };
    });

    const [order] = await db
      .insert(ordersTable)
      .values({ tableId: table.id, tableToken, totalAmount: String(total), notes: notes ?? null })
      .returning();

    await db.insert(orderItemsTable).values(orderItemsData.map((i) => ({ ...i, orderId: order.id })));

    const fullOrder = await getOrderWithItems(order.id);

    const io: SocketIOServer = req.app.get("io");
    io.to(`restaurant_1`).emit("order:new", fullOrder);
    io.to(`session_${tableToken}`).emit("order:updated", fullOrder);

    await db.update(tablesTable).set({ status: "occupied" }).where(eq(tablesTable.id, table.id));

    res.status(201).json(fullOrder);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.get("/orders/:orderId", async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId!);
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
    const orderId = parseInt(req.params.orderId!);
    const { status } = req.body as { status: string };

    const [updated] = await db
      .update(ordersTable)
      .set({ status: status as "pending" | "confirmed" | "preparing" | "ready" | "served" | "paid" | "cancelled", updatedAt: new Date() })
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
        await db.update(tablesTable).set({ status: "available" }).where(eq(tablesTable.id, updated.tableId));
      }
    }

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
