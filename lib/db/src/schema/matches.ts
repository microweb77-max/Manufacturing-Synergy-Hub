import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
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
});

export type Match = typeof matchesTable.$inferSelect;
export type InsertMatch = typeof matchesTable.$inferInsert;
