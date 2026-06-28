import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const performanceLogsTable = pgTable("performance_logs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  companyId: integer("company_id").notNull(),
  role: text("role").notNull().default(""),
  contributionPercent: integer("contribution_percent").notNull().default(0),
  revenue: text("revenue"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type PerformanceLog = typeof performanceLogsTable.$inferSelect;
export type InsertPerformanceLog = typeof performanceLogsTable.$inferInsert;
