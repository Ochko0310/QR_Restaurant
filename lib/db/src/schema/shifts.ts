import { pgTable, serial, integer, timestamp, text } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const staffShiftsTable = pgTable("staff_shifts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  clockInAt: timestamp("clock_in_at").defaultNow().notNull(),
  clockOutAt: timestamp("clock_out_at"),
  note: text("note"),
});

export type StaffShift = typeof staffShiftsTable.$inferSelect;
