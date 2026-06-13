import { boolean, index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { createdAt, uuidPk } from "./_shared";
import { brands } from "./brands";

/** Per-playbook frequency cap override. */
export type PlaybookFrequencyCap = { perDay?: number; perWeek?: number };

/**
 * `playbooks` — declarative outbound campaigns per brand (delivery check-in,
 * exchange rescue, replenishment, ...). The scheduler (M8) decides whether/when to
 * send; the LLM only writes the wording. `key` is free text so brands can add
 * custom playbooks.
 */
export const playbooks = pgTable(
  "playbooks",
  {
    id: uuidPk(),
    brandId: uuid()
      .notNull()
      .references(() => brands.id),
    key: text().notNull(),
    triggerType: text(),
    enabled: boolean().notNull().default(false),
    promptTemplate: text(),
    delayMinutes: integer(),
    frequencyCap: jsonb().$type<PlaybookFrequencyCap>(),
    createdAt: createdAt(),
  },
  (t) => [index("playbooks_brand_key_idx").on(t.brandId, t.key)],
);
