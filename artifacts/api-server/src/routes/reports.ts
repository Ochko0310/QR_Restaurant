import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, orderItemsTable } from "@workspace/db";
import { gte, lte, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/reports/summary", requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };

    const conditions = [];
    if (from) conditions.push(gte(ordersTable.createdAt, new Date(from)));
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(ordersTable.createdAt, toDate));
    }

    const orders = conditions.length > 0
      ? await db.select().from(ordersTable).where(and(...conditions))
      : await db.select().from(ordersTable);

    const paidOrders = orders.filter((o) => o.status !== "cancelled");
    const totalOrders = paidOrders.length;
    const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const ordersByStatus: Record<string, number> = {};
    for (const order of orders) {
      ordersByStatus[order.status] = (ordersByStatus[order.status] ?? 0) + 1;
    }

    const orderIds = paidOrders.map((o) => o.id);
    const itemAgg: Record<string, { name: string; quantity: number; revenue: number }> = {};

    if (orderIds.length > 0) {
      const items = await db.select().from(orderItemsTable);
      for (const item of items) {
        if (!orderIds.includes(item.orderId)) continue;
        if (!itemAgg[item.menuItemName]) {
          itemAgg[item.menuItemName] = { name: item.menuItemName, quantity: 0, revenue: 0 };
        }
        itemAgg[item.menuItemName]!.quantity += item.quantity;
        itemAgg[item.menuItemName]!.revenue += Number(item.unitPrice) * item.quantity;
      }
    }

    const topItems = Object.values(itemAgg)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    res.json({ totalOrders, totalRevenue, averageOrderValue, ordersByStatus, topItems });
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

export default router;
