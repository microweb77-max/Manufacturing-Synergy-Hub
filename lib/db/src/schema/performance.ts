import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  index,
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
},
  (t) => [index("performance_logs_project_id_idx").on(t.projectId), index("performance_logs_company_id_idx").on(t.companyId)],
);

export type PerformanceLog = typeof performanceLogsTable.$inferSelect;
export type InsertPerformanceLog = typeof performanceLogsTable.$inferInsert;
