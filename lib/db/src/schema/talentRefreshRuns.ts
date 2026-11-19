import { pgTable, text, timestamp, integer, primaryKey } from "drizzle-orm/pg-core";

// One row per completed daily scheduled talent collection, keyed by the
// Asia/Ho_Chi_Minh calendar day ("YYYY-MM-DD") and post type ("hiring" /
// "seeking"). A successful run makes retries on the same day a no-op.
export const talentRefreshRunsTable = pgTable("talent_refresh_runs", {
  scheduledDay: text("scheduled_day").notNull(),
  postType: text("post_type").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  inserted: integer("inserted").notNull(),
  skipped: integer("skipped").notNull(),
}, (t) => [primaryKey({ columns: [t.scheduledDay, t.postType] })]);

export type TalentRefreshRun = typeof talentRefreshRunsTable.$inferSelect;
