import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { talentPostsTable } from "./talent";

export const talentContactRequestsTable = pgTable("talent_contact_requests", {
  id: serial("id").primaryKey(),
  talentPostId: integer("talent_post_id")
    .notNull()
    .references(() => talentPostsTable.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  contactPerson: text("contact_person").notNull(),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type TalentContactRequest = typeof talentContactRequestsTable.$inferSelect;
export type InsertTalentContactRequest = typeof talentContactRequestsTable.$inferInsert;
