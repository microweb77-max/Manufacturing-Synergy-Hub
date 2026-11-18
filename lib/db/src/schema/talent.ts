import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const talentPostsTable = pgTable("talent_posts", {
  id: serial("id").primaryKey(),
  ownerCompanyId: integer("owner_company_id"),
  postType: text("post_type").notNull(),
  title: text("title").notNull(),
  authorName: text("author_name").notNull(),
  position: text("position").notNull().default(""),
  location: text("location").notNull().default(""),
  employmentType: text("employment_type"),
  experienceLevel: text("experience_level"),
  headcount: integer("headcount"),
  skills: text("skills").array().notNull().default([]),
  description: text("description").notNull().default(""),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  source: text("source"),
  sourceUrl: text("source_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [index("talent_posts_post_type_idx").on(t.postType)]);

export type TalentPost = typeof talentPostsTable.$inferSelect;
export type InsertTalentPost = typeof talentPostsTable.$inferInsert;
