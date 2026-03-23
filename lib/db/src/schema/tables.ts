import { pgTable, text, serial, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tableStatusEnum = pgEnum("table_status", ["available", "occupied", "reserved"]);

export const tablesTable = pgTable("tables", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull().unique(),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull().default(4),
  status: tableStatusEnum("status").notNull().default("available"),
  qrToken: text("qr_token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTableSchema = createInsertSchema(tablesTable).omit({ id: true, createdAt: true, qrToken: true });
export type InsertTable = z.infer<typeof insertTableSchema>;
export type TableRow = typeof tablesTable.$inferSelect;
