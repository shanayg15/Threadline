import { jsonb, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { createdAt, uuidPk } from "./_shared";
import { brands } from "./brands";
import { conversations } from "./conversations";
import { pendingActionStatus, pendingActionType } from "./enums";

/**
 * `pendingActions` — the confirmation gate. A side-effect tool (place order,
 * create exchange, etc.) creates a `pending` action and asks the customer for an
 * explicit yes; nothing executes until that confirmation.
 *
 * Invariant: at most one `pending` action per conversation at a time. Enforced in
 * the repo/service AND, defensively, by a partial unique index here.
 */
export const pendingActions = pgTable(
  "pending_actions",
  {
    id: uuidPk(),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id),
    brandId: uuid()
      .notNull()
      .references(() => brands.id),
    type: pendingActionType().notNull(),
    payload: jsonb().$type<Record<string, unknown>>(),
    status: pendingActionStatus().notNull().default("pending"),
    createdAt: createdAt(),
    confirmedAt: timestamp({ withTimezone: true }),
    expiresAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex("pending_actions_one_open_per_conversation")
      .on(t.conversationId)
      .where(sql`${t.status} = 'pending'`),
  ],
);
