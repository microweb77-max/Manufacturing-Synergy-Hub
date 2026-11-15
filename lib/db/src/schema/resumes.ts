import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { talentPostsTable } from "./talent";

export const resumeSubmissionsTable = pgTable("resume_submissions", {
  id: serial("id").primaryKey(),
  talentPostId: integer("talent_post_id")
    .notNull()
    .references(() => talentPostsTable.id, { onDelete: "cascade" }),
  applicantName: text("applicant_name").notNull(),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  message: text("message").notNull().default(""),
  resumeFileName: text("resume_file_name").notNull().default(""),
  resumeFileData: text("resume_file_data").notNull().default(""),
  status: text("status").notNull().default("received"),
  adminNote: text("admin_note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
},
  (t) => [index("resume_submissions_talent_post_id_idx").on(t.talentPostId)],
);

export type ResumeSubmission = typeof resumeSubmissionsTable.$inferSelect;
export type InsertResumeSubmission = typeof resumeSubmissionsTable.$inferInsert;
