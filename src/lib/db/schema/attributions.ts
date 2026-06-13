import { boolean, index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { createdAt, uuidPk } from "./_shared";
import { brands } from "./brands";
import { conversations } from "./conversations";
import { orders } from "./orders";

/**
 * `attributions` — measurement linking a conversation to an order. Revenue is in
 * integer cents. Honest lift comes from comparing treatment vs control experiment
 * groups (M8), not from crediting every thread-with-a-link.
 */
export const attributions = pgTable(
  "attributions",
  {
    id: uuidPk(),
    brandId: uuid()
      .notNull()
      .references(() => brands.id),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id),
    orderId: uuid()
      .notNull()
      .references(() => orders.id),
    linkClicked: boolean().notNull().default(false),
    discountCode: text(),
    utm: jsonb().$type<Record<string, string>>(),
    attributedRevenueCents: integer(),
    createdAt: createdAt(),
  },
  (t) => [
    index("attributions_brand_idx").on(t.brandId),
    index("attributions_order_idx").on(t.orderId),
  ],
);
