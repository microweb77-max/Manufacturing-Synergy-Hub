import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  timestamp,
} from "drizzle-orm/pg-core";

export const companiesTable = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  taxCode: text("tax_code"),
  description: text("description").notNull().default(""),
  location: text("location").notNull().default(""),
  capabilityTags: text("capability_tags").array().notNull().default([]),
  techSpecs: text("tech_specs").notNull().default(""),
  contactEmail: text("contact_email").notNull().default(""),
  logoUrl: text("logo_url"),
  trustScore: integer("trust_score").notNull().default(50),
  rating: doublePrecision("rating").notNull().default(0),
  projectsCompleted: integer("projects_completed").notNull().default(0),
  collaborationCount: integer("collaboration_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Company = typeof companiesTable.$inferSelect;
export type InsertCompany = typeof companiesTable.$inferInsert;
