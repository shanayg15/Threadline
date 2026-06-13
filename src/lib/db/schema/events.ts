import { index, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

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
    createdAt: createdAt(),
    processedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("events_brand_unprocessed_idx").on(t.brandId, t.processedAt)],
);
