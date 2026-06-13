import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
  (t) => [index("integrations_brand_kind_idx").on(t.brandId, t.kind)],
);
