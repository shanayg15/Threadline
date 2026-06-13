import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { createdAt, uuidPk } from "./_shared";
import { brands } from "./brands";
import { consentStatus, experimentGroup } from "./enums";

/**
 * `customers` — one row per phone number per brand. The unique index on
 * (brandId, phoneE164) is the de-dup key for inbound resolution and prevents the
 * same number existing twice within a brand.
 */
export const customers = pgTable(
  "customers",
  {
    id: uuidPk(),
    brandId: uuid()
      .notNull()
      .references(() => brands.id),
    shopifyCustomerId: text(),
    // Explicit column name: the snake_case converter would otherwise emit
    // "phone_e_164" for phoneE164.
    phoneE164: text("phone_e164").notNull(),
    name: text(),
    email: text(),
    consentStatus: consentStatus().notNull().default("unknown"),
    consentSource: text(),
    consentAt: timestamp({ withTimezone: true }),
    optedOutAt: timestamp({ withTimezone: true }),
    experimentGroup: experimentGroup(),
    timezone: text().notNull().default("America/New_York"),
    tags: jsonb().$type<string[]>(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("customers_brand_phone_uq").on(t.brandId, t.phoneE164),
    uniqueIndex("customers_brand_shopify_uq")
      .on(t.brandId, t.shopifyCustomerId)
      .where(sql`${t.shopifyCustomerId} is not null`),
  ],
);
