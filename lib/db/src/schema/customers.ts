import { pgTable, serial, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { tablesTable } from "./tables";

export const customersTable = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
});

export const tableSessionsTable = pgTable("table_sessions", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id").notNull().references(() => tablesTable.id),
  customerId: uuid("customer_id").references(() => customersTable.id),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  checkedInAt: timestamp("checked_in_at"),
  endedAt: timestamp("ended_at"),
});

export type Customer = typeof customersTable.$inferSelect;
export type TableSession = typeof tableSessionsTable.$inferSelect;
