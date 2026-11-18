import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const companyVerificationsTable = pgTable("company_verifications", {
  companyId: integer("company_id").primaryKey().references(() => companiesTable.id, { onDelete: "cascade" }),
  method: text("method").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
});
export const companyMembersTable = pgTable("company_members", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  role: text("role", { enum: ["company_admin", "staff"] }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("company_member_unique").on(t.companyId, t.userId), index("company_member_user").on(t.userId)]);
export const companyClaimsTable = pgTable("company_claims", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  method: text("method", { enum: ["email", "manual"] }).notNull(),
  status: text("status").notNull().default("pending"),
  email: text("email"),
  tokenHash: text("token_hash"),
  taxCode: text("tax_code"),
  evidencePath: text("evidence_path"),
  reviewNote: text("review_note"),
  reviewedBy: text("reviewed_by"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("claim_token_unique").on(t.tokenHash), index("claims_company").on(t.companyId)]);
export const companyInvitationsTable = pgTable("company_invitations", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role", { enum: ["company_admin", "staff"] }).notNull(),
  invitedBy: text("invited_by").notNull(),
  tokenHash: text("token_hash").notNull(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("invite_token_unique").on(t.tokenHash)]);