import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Parse "timestamp without time zone" as UTC so it round-trips correctly
// regardless of the server's local timezone.
pg.types.setTypeParser(1114, (str: string) => new Date(str + "Z"));

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Force every connection to use UTC so NOW()/DEFAULT timestamps are stored in UTC
pool.on("connect", (client) => {
  client.query("SET TIME ZONE 'UTC'").catch(() => {});
});

export const db = drizzle(pool, { schema });

export * from "./schema";
