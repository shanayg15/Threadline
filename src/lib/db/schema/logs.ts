import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { createdAt, uuidPk } from "./_shared";
import { auditActor, consentAction } from "./enums";
import { brands } from "./brands";
import { customers } from "./customers";
import { users } from "./users";

/**
 * `consentLog` — APPEND-ONLY compliance audit of consent changes (opt in/out,
 * help, start). Its repo exposes record/read only; never update or delete (you may
 * need to prove consent and opt-out timing).
 */
export const consentLog = pgTable(
  "consent_log",
  {
    id: uuidPk(),
    brandId: uuid()
      .notNull()
      .references(() => brands.id),
    customerId: uuid().references(() => customers.id),
    action: consentAction().notNull(),
    source: text(),
    rawMessage: text(),
    createdAt: createdAt(),
  },
  (t) => [index("consent_log_brand_customer_idx").on(t.brandId, t.customerId)],
);

/**
 * `auditLog` — APPEND-ONLY trust/audit trail: every AI decision, tool call,
 * outbound message, human takeover, and consent change. Repo exposes record/read
 * only; never update or delete.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuidPk(),
    brandId: uuid()
      .notNull()
      .references(() => brands.id),
    actor: auditActor().notNull(),
    actorUserId: uuid().references(() => users.id),
    action: text().notNull(),
    targetType: text(),
    targetId: text(),
    payload: jsonb().$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_brand_created_idx").on(t.brandId, t.createdAt)],
);
