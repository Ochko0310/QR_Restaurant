import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, ordersTable, orderItemsTable, tablesTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";

const router = Router();

router.post("/customers", async (_req, res) => {
  try {
    const [customer] = await db.insert(customersTable).values({}).returning();
    res.status(201).json({ id: customer.id, createdAt: customer.createdAt });
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.get("/customers/:id", async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id));
    if (!customer) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    await db.update(customersTable).set({ lastSeenAt: new Date() }).where(eq(customersTable.id, id));
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.get("/customers/:id/orders", async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const orders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.customerId, id))
      .orderBy(desc(ordersTable.createdAt));

    if (orders.length === 0) {
      res.json([]);
      return;
    }

    const orderIds = orders.map((o) => o.id);
    const tableIds = [...new Set(orders.map((o) => o.tableId))];

    const items = await db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds));
    const tables = await db.select().from(tablesTable).where(inArray(tablesTable.id, tableIds));
    const tableMap = new Map(tables.map((t) => [t.id, t]));

    const result = orders.map((order) => ({
      ...order,
      tableName: tableMap.get(order.tableId)?.name ?? "",
      totalAmount: Number(order.totalAmount),
      discount: Number(order.discount),
      items: items
        .filter((i) => i.orderId === order.id)
        .map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

export default router;
