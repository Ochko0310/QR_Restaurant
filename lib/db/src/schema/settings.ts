import { pgTable, text, serial, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const restaurantSettingsTable = pgTable("restaurant_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRestaurantSettingSchema = createInsertSchema(restaurantSettingsTable).omit({ id: true, updatedAt: true });
export type InsertRestaurantSetting = z.infer<typeof insertRestaurantSettingSchema>;
export type RestaurantSetting = typeof restaurantSettingsTable.$inferSelect;
