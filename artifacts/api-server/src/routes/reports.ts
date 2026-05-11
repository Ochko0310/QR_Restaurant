import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, orderItemsTable, tablesTable } from "@workspace/db";
import { gte, lte, and, sql, eq, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

router.get("/reports/summary", requireAuth, requireRole("manager", "cashier"), async (req, res) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };

    const conditions = [sql`${ordersTable.status} = 'paid'`];
    if (from) conditions.push(gte(ordersTable.createdAt, new Date(from)));
    if (to) conditions.push(lte(ordersTable.createdAt, new Date(to)));

    const paidOrders = await db.select().from(ordersTable).where(and(...conditions));

    const totalOrders = paidOrders.length;
    const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const totalDiscount = paidOrders.reduce((sum, o) => sum + Number(o.discount), 0);
    const netRevenue = totalRevenue - totalDiscount;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Average service time (created -> paid)
    let avgServiceMinutes = 0;
    const serviceTimes: number[] = [];
    for (const o of paidOrders) {
      if (o.paidAt) {
        const diff = (new Date(o.paidAt).getTime() - new Date(o.createdAt).getTime()) / 60000;
        serviceTimes.push(diff);
      }
    }
    if (serviceTimes.length > 0) {
      avgServiceMinutes = Math.round(serviceTimes.reduce((a, b) => a + b, 0) / serviceTimes.length);
    }

    // Average prep time (created -> printedAt i.e. sent to kitchen)
    let avgPrepMinutes = 0;
    const prepTimes: number[] = [];
    for (const o of paidOrders) {
      if (o.printedAt && o.paidAt) {
        const diff = (new Date(o.paidAt).getTime() - new Date(o.printedAt).getTime()) / 60000;
        prepTimes.push(diff);
      }
    }
    if (prepTimes.length > 0) {
      avgPrepMinutes = Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length);
    }

    // Peak hours analysis (aggregated in SQL)
    const peakHoursRows = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${ordersTable.createdAt})::int`,
        orders: sql<number>`COUNT(*)::int`,
        revenue: sql<number>`SUM(${ordersTable.totalAmount})::float`,
      })
      .from(ordersTable)
      .where(and(...conditions))
      .groupBy(sql`EXTRACT(HOUR FROM ${ordersTable.createdAt})`)
      .orderBy(sql`COUNT(*) DESC`);
    const peakHours = peakHoursRows.map((r) => ({
      hour: Number(r.hour),
      orders: Number(r.orders),
      revenue: Number(r.revenue ?? 0),
    }));

    // Payment method breakdown
    const paymentBreakdown = { cash: 0, bank: 0 };
    for (const o of paidOrders) {
      const method = o.paymentMethod ?? "cash";
      paymentBreakdown[method] = (paymentBreakdown[method] ?? 0) + Number(o.totalAmount);
    }

    // All orders in period (for status counts)
    const allConditions = [];
    if (from) allConditions.push(gte(ordersTable.createdAt, new Date(from)));
    if (to) allConditions.push(lte(ordersTable.createdAt, new Date(to)));
    const allOrders = allConditions.length > 0
      ? await db.select().from(ordersTable).where(and(...allConditions))
      : await db.select().from(ordersTable);

    const ordersByStatus: Record<string, number> = {};
    for (const order of allOrders) {
      ordersByStatus[order.status] = (ordersByStatus[order.status] ?? 0) + 1;
    }
    const cancelledCount = ordersByStatus["cancelled"] ?? 0;

    // Top items (SQL aggregation restricted to paid-order items)
    const orderIds = paidOrders.map((o) => o.id);
    let topItems: Array<{ name: string; quantity: number; revenue: number }> = [];
    if (orderIds.length > 0) {
      const rows = await db
        .select({
          name: orderItemsTable.menuItemName,
          quantity: sql<number>`SUM(${orderItemsTable.quantity})::int`,
          revenue: sql<number>`SUM(${orderItemsTable.unitPrice} * ${orderItemsTable.quantity})::float`,
        })
        .from(orderItemsTable)
        .where(inArray(orderItemsTable.orderId, orderIds))
        .groupBy(orderItemsTable.menuItemName)
        .orderBy(sql`SUM(${orderItemsTable.quantity}) DESC`);
      topItems = rows.map((r) => ({ name: r.name, quantity: Number(r.quantity), revenue: Number(r.revenue ?? 0) }));
    }

    // Table turnover (unique tables served)
    const uniqueTables = new Set(paidOrders.map((o) => o.tableId));
    const tableTurnover = uniqueTables.size;

    res.json({
      totalOrders,
      totalRevenue,
      totalDiscount,
      netRevenue,
      averageOrderValue,
      avgServiceMinutes,
      avgPrepMinutes,
      cancelledCount,
      tableTurnover,
      paymentBreakdown,
      peakHours,
      ordersByStatus,
      topItems,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

// Export paid orders as CSV (Excel opens natively)
router.get("/reports/export", requireAuth, requireRole("manager", "cashier"), async (req, res) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const conditions = [sql`${ordersTable.status} = 'paid'`];
    if (from) conditions.push(gte(ordersTable.createdAt, new Date(from)));
    if (to) conditions.push(lte(ordersTable.createdAt, new Date(to)));

    const orders = await db.select().from(ordersTable).where(and(...conditions)).orderBy(ordersTable.createdAt);
    const tableIds = [...new Set(orders.map((o) => o.tableId))];
    const tables = tableIds.length > 0
      ? await db.select().from(tablesTable).where(inArray(tablesTable.id, tableIds))
      : [];
    const tableMap = new Map(tables.map((t) => [t.id, t]));

    const orderIds = orders.map((o) => o.id);
    const items = orderIds.length > 0
      ? await db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds))
      : [];
    const itemsByOrder = new Map<number, typeof items>();
    for (const item of items) {
      const arr = itemsByOrder.get(item.orderId) ?? [];
      arr.push(item);
      itemsByOrder.set(item.orderId, arr);
    }

    const header = [
      "Захиалга ID", "Огноо", "Ширээ", "Төлбөр", "Нийт дүн",
      "Хөнгөлөлт", "Цэвэр орлого", "Хоолнууд",
    ];
    const lines = [header.map(csvEscape).join(",")];
    for (const o of orders) {
      const total = Number(o.totalAmount);
      const discount = Number(o.discount);
      const net = total - discount;
      const itemsStr = (itemsByOrder.get(o.id) ?? [])
        .map((i) => `${i.menuItemName} x${i.quantity}`)
        .join("; ");
      lines.push([
        o.id,
        new Date(o.createdAt).toISOString(),
        tableMap.get(o.tableId)?.name ?? "",
        o.paymentMethod ?? "cash",
        total,
        discount,
        net,
        itemsStr,
      ].map(csvEscape).join(","));
    }

    // UTF-8 BOM so Excel displays Mongolian correctly
    const body = "\uFEFF" + lines.join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="report_${(from ?? "all").slice(0, 10)}_${(to ?? "all").slice(0, 10)}.csv"`);
    res.send(body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

export default router;
