import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const supplyOffersTable = pgTable("supply_offers", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  category: text("category").notNull().default("원재료"),
  itemName: text("item_name").notNull(),
  unitPrice: text("unit_price").notNull().default(""),
  unit: text("unit").notNull().default(""),
  currency: text("currency").notNull().default("USD"),
  minOrderQty: text("min_order_qty").notNull().default(""),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const offerMatchesTable = pgTable("offer_matches", {
  id: serial("id").primaryKey(),
  offerId: integer("offer_id").notNull(),
  clientCompanyNo: integer("client_company_no"),
  clientCompanyName: text("client_company_name").notNull(),
  contactName: text("contact_name").notNull().default(""),
  contactInfo: text("contact_info").notNull().default(""),
  message: text("message").notNull().default(""),
  status: text("status").notNull().default("pending"),
  adminNote: text("admin_note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SupplyOffer = typeof supplyOffersTable.$inferSelect;
export type InsertSupplyOffer = typeof supplyOffersTable.$inferInsert;
export type OfferMatch = typeof offerMatchesTable.$inferSelect;
export type InsertOfferMatch = typeof offerMatchesTable.$inferInsert;
