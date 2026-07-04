import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const bannersTable = pgTable("banners", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().default(""),
  imageUrl: text("image_url").notNull(),
  linkUrl: text("link_url"),
  durationSeconds: integer("duration_seconds").notNull().default(5),
  displayOrder: integer("display_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Banner = typeof bannersTable.$inferSelect;
export type InsertBanner = typeof bannersTable.$inferInsert;
