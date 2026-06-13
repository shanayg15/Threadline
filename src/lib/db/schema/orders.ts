import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { createdAt, uuidPk } from "./_shared";
import { brands } from "./brands";
import { conversations } from "./conversations";
import { customers } from "./customers";
import { fulfillmentStatus } from "./enums";
import { productVariants } from "./products";

/** `orders` — orders synced from Shopify (M4); totals in integer cents. */
export const orders = pgTable(
  "orders",
  {
    id: uuidPk(),
    brandId: uuid()
      .notNull()
      .references(() => brands.id),
    customerId: uuid()
      .notNull()
      .references(() => customers.id),
    shopifyOrderId: text(),
    status: text(),
    totalCents: integer(),
    fulfillmentStatus: fulfillmentStatus().notNull().default("unfulfilled"),
    trackingNumber: text(),
    carrier: text(),
    shippedAt: timestamp({ withTimezone: true }),
    deliveredAt: timestamp({ withTimezone: true }),
    // Which thread drove/assisted this order (set by attribution, M8).
    attributedConversationId: uuid().references(() => conversations.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("orders_brand_customer_idx").on(t.brandId, t.customerId),
    index("orders_brand_fulfillment_idx").on(t.brandId, t.fulfillmentStatus),
  ],
);

/** `orderLineItems` — line items for an order; prices in integer cents. */
export const orderLineItems = pgTable(
  "order_line_items",
  {
    id: uuidPk(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id),
    brandId: uuid()
      .notNull()
      .references(() => brands.id),
    variantId: uuid().references(() => productVariants.id),
    title: text(),
    qty: integer().notNull().default(1),
    priceCents: integer(),
  },
  (t) => [index("order_line_items_order_idx").on(t.orderId)],
);
