import { pgTable, date, timestamp, integer } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

// Calendar day in Asia/Ho_Chi_Minh, not the server's local timezone.
export const newsRefreshRunsTable = pgTable("news_refresh_runs", {
  scheduledDay: date("scheduled_day", { mode: "string" }).primaryKey(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  inserted: integer("inserted").notNull(),
  skipped: integer("skipped").notNull(),
});

export const insertNewsRefreshRunSchema = z.object({
  scheduledDay: z.iso.date(),
  completedAt: z.date().optional(),
  inserted: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});
export type NewsRefreshRun = typeof newsRefreshRunsTable.$inferSelect;
export type InsertNewsRefreshRun = typeof newsRefreshRunsTable.$inferInsert;
