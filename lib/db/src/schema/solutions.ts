import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const solutionsTable = pgTable("solutions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default(""),
  tags: text("tags").array().notNull().default([]),
  companyIds: integer("company_ids").array().notNull().default([]),
  imageUrl: text("image_url"),
  featured: boolean("featured").notNull().default(false),
  outcome: text("outcome"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Solution = typeof solutionsTable.$inferSelect;
export type InsertSolution = typeof solutionsTable.$inferInsert;
