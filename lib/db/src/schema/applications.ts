import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const projectApplicationsTable = pgTable("project_applications", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  companyId: integer("company_id").notNull(),
  message: text("message").notNull().default(""),
  contactName: text("contact_name").notNull().default(""),
  contactInfo: text("contact_info").notNull().default(""),
  status: text("status").notNull().default("pending"),
  adminNote: text("admin_note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ProjectApplication = typeof projectApplicationsTable.$inferSelect;
export type InsertProjectApplication =
  typeof projectApplicationsTable.$inferInsert;
