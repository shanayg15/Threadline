import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { createdAt, uuidPk } from "./_shared";
import { brands } from "./brands";
import { customers } from "./customers";
import { eventType } from "./enums";

/** `events` — lifecycle triggers consumed by the scheduler (M8). */
export const events = pgTable(
  "events",
  {
    id: uuidPk(),
    brandId: uuid()
      .notNull()
      .references(() => brands.id),
    customerId: uuid().references(() => customers.id),
    type: eventType().notNull(),
    payload: jsonb().$type<Record<string, unknown>>(),
    // Optional natural-key for at-most-once events (e.g. one order_fulfilled per
    // order), so webhook retries / double-topics can't emit duplicate triggers.
    dedupeKey: text(),
    createdAt: createdAt(),
    processedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("events_brand_unprocessed_idx").on(t.brandId, t.processedAt),
    uniqueIndex("events_brand_dedupe_uq")
      .on(t.brandId, t.dedupeKey)
      .where(sql`${t.dedupeKey} is not null`),
  ],
);
