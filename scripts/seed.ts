import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL not set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await pool.connect();

  try {
    console.log("Seeding database...");

    await client.query(`DELETE FROM order_items; DELETE FROM orders; DELETE FROM tables; DELETE FROM menu_items; DELETE FROM menu_categories; DELETE FROM users;`);

    const saltRounds = 10;
    const users = [
      { username: "manager", password: "manager123", name: "Менежер Болд", role: "manager" },
      { username: "chef", password: "chef123", name: "Тогооч Батаа", role: "chef" },
      { username: "cashier", password: "cashier123", name: "Кассир Сарнай", role: "cashier" },
    ];

    for (const user of users) {
      const hash = await bcrypt.hash(user.password, saltRounds);
      await client.query(
        `INSERT INTO users (username, password_hash, name, role) VALUES ($1, $2, $3, $4)`,
        [user.username, hash, user.name, user.role]
      );
      console.log(`Created user: ${user.username}`);
    }

    const tables = [
      { number: 1, name: "1-р ширээ", capacity: 2 },
      { number: 2, name: "2-р ширээ", capacity: 4 },
      { number: 3, name: "3-р ширээ", capacity: 4 },
      { number: 4, name: "4-р ширээ", capacity: 6 },
      { number: 5, name: "5-р ширээ", capacity: 6 },
      { number: 6, name: "VIP ширээ", capacity: 8 },
    ];

    for (const t of tables) {
      const token = uuidv4();
      await client.query(
        `INSERT INTO tables (number, name, capacity, status, qr_token) VALUES ($1, $2, $3, 'available', $4)`,
        [t.number, t.name, t.capacity, token]
      );
    }
    console.log("Created tables");

    const categories = [
      { name: "Шөл, Цэнгэг ус", description: "Монгол шөл ба усны ундаа", sort_order: 1 },
      { name: "Үндсэн хоол", description: "Үндсэн хоолнуудын цэс", sort_order: 2 },
      { name: "Шарсан хоол", description: "Шарсан болон жарсан хоол", sort_order: 3 },
      { name: "Буузны цэс", description: "Монгол бууз ба цаасан боов", sort_order: 4 },
      { name: "Ундаа", description: "Ундаа, шүүс ба кофе", sort_order: 5 },
      { name: "Амтат хоол", description: "Амтат идэш, бялуу", sort_order: 6 },
    ];

    const catIds: number[] = [];
    for (const cat of categories) {
      const result = await client.query(
        `INSERT INTO menu_categories (name, description, sort_order) VALUES ($1, $2, $3) RETURNING id`,
        [cat.name, cat.description, cat.sort_order]
      );
      catIds.push(result.rows[0].id);
    }
    console.log("Created categories");

    const menuItems = [
      { catIdx: 0, name: "Тас шөл", description: "Уламжлалт Монгол тас шөл", price: "8000", prep: 10 },
      { catIdx: 0, name: "Хоол шөл", description: "Хоолтой байгалийн шөл", price: "9500", prep: 12 },
      { catIdx: 1, name: "Цагаан будаатай тахиа", description: "Шарсан тахиа будаатай хамт", price: "18000", prep: 20 },
      { catIdx: 1, name: "Тухай гахайн мах", description: "Гахайн мах хиамтай", price: "22000", prep: 25 },
      { catIdx: 1, name: "Монгол цуйван", description: "Гараар хийсэн цуйван", price: "16000", prep: 20 },
      { catIdx: 2, name: "Шарсан үхрийн мах", description: "Томат болон хатуу жимсгэнэтэй", price: "28000", prep: 30 },
      { catIdx: 2, name: "Шарсан загас", description: "Далайн загас хүнсний ногоотой", price: "25000", prep: 25 },
      { catIdx: 3, name: "Бууз (10ш)", description: "Уламжлалт монгол бууз", price: "15000", prep: 25 },
      { catIdx: 3, name: "Хуушуур (5ш)", description: "Шарсан хуушуур", price: "12000", prep: 20 },
      { catIdx: 4, name: "Кофе", description: "Espresso, Latte, Cappuccino", price: "6000", prep: 5 },
      { catIdx: 4, name: "Жүүс", description: "Алим, жүрж, шалган жүүс", price: "4500", prep: 3 },
      { catIdx: 4, name: "Цай", description: "Ногоон, хар, сүүтэй цай", price: "3500", prep: 5 },
      { catIdx: 5, name: "Шоколадан бялуу", description: "Дулаан шоколадан бялуу мөстэй", price: "9000", prep: 10 },
      { catIdx: 5, name: "Зуслангийн тоор", description: "Цэвэр зуслангийн тоор", price: "7500", prep: 5 },
    ];

    for (const item of menuItems) {
      await client.query(
        `INSERT INTO menu_items (category_id, name, description, price, available, preparation_time) VALUES ($1, $2, $3, $4, true, $5)`,
        [catIds[item.catIdx], item.name, item.description, item.price, item.prep]
      );
    }
    console.log("Created menu items");

    console.log("✅ Seed complete!");
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
