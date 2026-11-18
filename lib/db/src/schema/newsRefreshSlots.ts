import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

// One row per completed hourly collection slot, keyed by the Asia/Ho_Chi_Minh
// hour ("YYYY-MM-DDTHH"), not the server's local timezone. Supersedes the
// per-day `news_refresh_runs` marker (kept for history; no longer written).
export const newsRefreshSlotsTable = pgTable("news_refresh_slots", {
  scheduledSlot: text("scheduled_slot").primaryKey(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  inserted: integer("inserted").notNull(),
  skipped: integer("skipped").notNull(),
});

export const insertNewsRefreshSlotSchema = z.object({
  scheduledSlot: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}$/),
  completedAt: z.date().optional(),
  inserted: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});
export type NewsRefreshSlot = typeof newsRefreshSlotsTable.$inferSelect;
export type InsertNewsRefreshSlot = typeof newsRefreshSlotsTable.$inferInsert;
