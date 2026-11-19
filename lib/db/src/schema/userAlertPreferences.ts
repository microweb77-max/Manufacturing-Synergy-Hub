import { pgTable, text, boolean, timestamp, primaryKey, unique } from "drizzle-orm/pg-core";

export const userAlertPreferencesTable = pgTable(
  "user_alert_preferences",
  {
    clerkUserId: text("clerk_user_id").notNull(),
    itemType: text("item_type").notNull(),
    categories: text("categories").array().notNull().default([]),
    weeklyEmail: boolean("weekly_email").notNull().default(false),
    email: text("email"),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    unsubscribeToken: text("unsubscribe_token").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.clerkUserId, t.itemType] }),
    unique("user_alert_preferences_token_uq").on(t.unsubscribeToken),
  ],
);

export type UserAlertPreference = typeof userAlertPreferencesTable.$inferSelect;
