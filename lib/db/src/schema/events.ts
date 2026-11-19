import { pgTable, serial, text, boolean, date, timestamp, index } from "drizzle-orm/pg-core";

export const eventsTable = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    originalTitle: text("original_title"),
    summary: text("summary").notNull().default(""),
    category: text("category").notNull().default("기타"),
    city: text("city").notNull().default("기타"),
    venue: text("venue"),
    organizer: text("organizer"),
    // YYYY-MM-DD strings (no timezone shifts).
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    isOnline: boolean("is_online").notNull().default(false),
    sourceUrl: text("source_url"),
    source: text("source").notNull().default("manual"), // auto | manual
    status: text("status").notNull().default("published"), // published | hidden
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_start_date_idx").on(t.startDate)],
);

export type EventRow = typeof eventsTable.$inferSelect;
export type InsertEvent = typeof eventsTable.$inferInsert;
