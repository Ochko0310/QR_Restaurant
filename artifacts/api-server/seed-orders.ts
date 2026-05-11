import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL not set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ORDER_COUNT = Number(process.env.SEED_ORDER_COUNT ?? 300);
const DAYS_BACK = Number(process.env.SEED_DAYS_BACK ?? 30);

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

async function seedOrders() {
  const client = await pool.connect();
  try {
    console.log(`Seeding ${ORDER_COUNT} paid orders across last ${DAYS_BACK} days...`);

    const tablesRes = await client.query<{ id: number; qr_token: string }>(
      `SELECT id, qr_token FROM tables`,
    );
    if (tablesRes.rows.length === 0) {
      throw new Error("No tables found. Run main seed first.");
    }
    const tables = tablesRes.rows;

    const menuRes = await client.query<{
      id: number;
      name: string;
      price: string;
    }>(`SELECT id, name, price FROM menu_items WHERE available = true`);
    if (menuRes.rows.length === 0) {
      throw new Error("No menu items found. Run main seed first.");
    }
    const menuItems = menuRes.rows;

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (let i = 0; i < ORDER_COUNT; i++) {
      const dayOffset = randomInt(0, DAYS_BACK - 1);
      const hour = (() => {
        const r = Math.random();
        if (r < 0.35) return randomInt(11, 14);
        if (r < 0.75) return randomInt(18, 21);
        return randomInt(8, 22);
      })();
      const minute = randomInt(0, 59);

      const createdAt = new Date(
        now - dayOffset * dayMs - (24 - hour) * 60 * 60 * 1000,
      );
      createdAt.setHours(hour, minute, randomInt(0, 59), 0);

      const printedAt = new Date(createdAt.getTime() + randomInt(2, 5) * 60_000);
      const paidAt = new Date(printedAt.getTime() + randomInt(15, 45) * 60_000);

      const table = pickRandom(tables);
      const paymentMethod = Math.random() < 0.6 ? "cash" : "bank";
      const itemCount = randomInt(1, 5);

      const lineItems: { menuItemId: number; name: string; qty: number; price: number }[] = [];
      let total = 0;
      const used = new Set<number>();
      for (let j = 0; j < itemCount; j++) {
        const item = pickRandom(menuItems);
        if (used.has(item.id)) continue;
        used.add(item.id);
        const qty = randomInt(1, 3);
        const price = Number(item.price);
        total += price * qty;
        lineItems.push({ menuItemId: item.id, name: item.name, qty, price });
      }
      if (lineItems.length === 0) continue;

      const discount = Math.random() < 0.1 ? randomInt(500, 3000) : 0;

      const orderRes = await client.query<{ id: number }>(
        `INSERT INTO orders
          (table_id, table_token, status, payment_method, total_amount, discount, created_at, updated_at, printed_at, paid_at)
         VALUES ($1, $2, 'paid', $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          table.id,
          table.qr_token,
          paymentMethod,
          String(total),
          String(discount),
          createdAt,
          paidAt,
          printedAt,
          paidAt,
        ],
      );
      const orderId = orderRes.rows[0]!.id;

      for (const li of lineItems) {
        await client.query(
          `INSERT INTO order_items (order_id, menu_item_id, menu_item_name, quantity, unit_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [orderId, li.menuItemId, li.name, li.qty, String(li.price)],
        );
      }

      if ((i + 1) % 50 === 0) {
        console.log(`  ${i + 1}/${ORDER_COUNT} inserted`);
      }
    }

    const summary = await client.query<{ count: string; revenue: string }>(
      `SELECT COUNT(*)::text AS count, COALESCE(SUM(total_amount), 0)::text AS revenue
       FROM orders WHERE status = 'paid'`,
    );
    const row = summary.rows[0]!;
    console.log(`\n✅ Done. Total paid orders in DB: ${row.count}, total revenue: ₮${Number(row.revenue).toLocaleString()}`);
  } finally {
    client.release();
    await pool.end();
  }
}

seedOrders().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
