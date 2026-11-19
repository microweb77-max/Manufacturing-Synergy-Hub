import { pgTable, serial, text, integer, timestamp, unique } from "drizzle-orm/pg-core";

// Shared by 행사 (itemType "event") and later 사업공고 (itemType "tender").
export const userBookmarksTable = pgTable(
  "user_bookmarks",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    itemType: text("item_type").notNull(),
    itemId: integer("item_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("user_bookmarks_user_item_uq").on(t.clerkUserId, t.itemType, t.itemId)],
);

export type UserBookmark = typeof userBookmarksTable.$inferSelect;
