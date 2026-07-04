import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const newsArticlesTable = pgTable("news_articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  category: text("category").notNull().default(""),
  originalTitle: text("original_title"),
  source: text("source"),
  sourceUrl: text("source_url"),
  publishedAt: text("published_at"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type NewsArticle = typeof newsArticlesTable.$inferSelect;
export type InsertNewsArticle = typeof newsArticlesTable.$inferInsert;
