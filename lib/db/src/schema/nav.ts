import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const navSettingsTable = pgTable("nav_settings", {
  key: text("key").primaryKey(),
  hidden: boolean("hidden").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type NavSetting = typeof navSettingsTable.$inferSelect;
export type InsertNavSetting = typeof navSettingsTable.$inferInsert;
