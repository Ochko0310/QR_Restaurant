import { pgTable, serial, integer, text, numeric, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
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

export const sessionParticipantsTable = pgTable(
  "session_participants",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id").notNull().references(() => tableSessionsTable.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull().references(() => customersTable.id),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    leftAt: timestamp("left_at"),
  },
  (t) => ({
    sessionCustomerUq: uniqueIndex("session_participants_session_customer_uq").on(t.sessionId, t.customerId),
  }),
);

export const sharedCartItemsTable = pgTable("shared_cart_items", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => tableSessionsTable.id, { onDelete: "cascade" }),
  menuItemId: integer("menu_item_id").notNull(),
  menuItemName: text("menu_item_name").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  notes: text("notes"),
  addedByCustomerId: uuid("added_by_customer_id").references(() => customersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Customer = typeof customersTable.$inferSelect;
export type TableSession = typeof tableSessionsTable.$inferSelect;
export type SessionParticipant = typeof sessionParticipantsTable.$inferSelect;
export type SharedCartItem = typeof sharedCartItemsTable.$inferSelect;
