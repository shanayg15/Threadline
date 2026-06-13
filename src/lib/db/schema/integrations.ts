import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { createdAt, uuidPk } from "./_shared";
import { brands } from "./brands";
import { integrationKind, integrationStatus } from "./enums";

/**
 * `integrations` — per-brand connected services. Secrets are encrypted at rest:
 * `credentialsCiphertext` holds the output of `encrypt()` (src/lib/db/crypto.ts),
 * never a raw token.
 */
export const integrations = pgTable(
  "integrations",
  {
    id: uuidPk(),
    brandId: uuid()
      .notNull()
      .references(() => brands.id),
    kind: integrationKind().notNull(),
    credentialsCiphertext: text(),
    status: integrationStatus().notNull().default("disconnected"),
    metadata: jsonb().$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  // One integration per kind per brand — enables atomic upsert + prevents dupes.
  (t) => [uniqueIndex("integrations_brand_kind_uq").on(t.brandId, t.kind)],
);
