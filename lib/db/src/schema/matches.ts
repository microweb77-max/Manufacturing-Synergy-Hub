import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  companyId: integer("company_id").notNull(),
  status: text("status").notNull().default("pending"),
  synergyScore: integer("synergy_score").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
},
  (t) => [index("matches_project_id_idx").on(t.projectId), index("matches_company_id_idx").on(t.companyId)],
);

export type Match = typeof matchesTable.$inferSelect;
export type InsertMatch = typeof matchesTable.$inferInsert;
