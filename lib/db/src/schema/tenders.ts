import { pgTable, serial, text, date, timestamp, integer, index, unique } from "drizzle-orm/pg-core";

export const tendersTable = pgTable(
  "tenders",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    originalTitle: text("original_title"),
    summary: text("summary").notNull().default(""),
    sourceType: text("source_type").notNull().default("gov_vn"), // gov_vn | kr_support | buyer_rfq
    category: text("category").notNull().default("기타"),
    buyer: text("buyer"),
    country: text("country"),
    city: text("city"),
    budget: text("budget"),
    eligibility: text("eligibility"),
    submission: text("submission"),
    // YYYY-MM-DD strings (no timezone shifts).
    publishedDate: date("published_date", { mode: "string" }),
    deadline: date("deadline", { mode: "string" }).notNull(),
    sourceUrl: text("source_url"),
    source: text("source").notNull().default("manual"), // auto | manual
    status: text("status").notNull().default("published"), // published | hidden
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tenders_deadline_idx").on(t.deadline)],
);

// "마감 3일 전" reminder is sent once per (member, tender): the row is the claim.
export const tenderDeadlineRemindersTable = pgTable(
  "tender_deadline_reminders",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    tenderId: integer("tender_id").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("tender_deadline_reminders_uq").on(t.clerkUserId, t.tenderId)],
);

export type TenderRow = typeof tendersTable.$inferSelect;
export type InsertTender = typeof tendersTable.$inferInsert;
