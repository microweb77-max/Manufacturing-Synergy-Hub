import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  ownerCompanyId: integer("owner_company_id"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  demandCompany: text("demand_company").notNull().default(""),
  category: text("category").notNull().default(""),
  requiredTags: text("required_tags").array().notNull().default([]),
  budget: text("budget"),
  status: text("status").notNull().default("open"),
  deadline: text("deadline"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Project = typeof projectsTable.$inferSelect;
export type InsertProject = typeof projectsTable.$inferInsert;
