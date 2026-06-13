import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { uuidPk } from "./_shared";
import { brands } from "./brands";
import { productStatus } from "./enums";

/** Variant option map, e.g. `{ size: "M", color: "Olive" }`. */
export type VariantOptions = { size?: string; color?: string } & Record<string, string>;

/** `products` — catalog products synced from Shopify (M4). */
export const products = pgTable(
  "products",
  {
    id: uuidPk(),
    brandId: uuid()
      .notNull()
      .references(() => brands.id),
    shopifyProductId: text(),
    title: text().notNull(),
    description: text(),
    // Agent-facing fit guidance, e.g. "runs roomy through the chest".
    fitNotes: text(),
    status: productStatus().notNull().default("active"),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("products_brand_idx").on(t.brandId)],
);

/**
 * `productVariants` — purchasable variants of a product.
 *
 * NOTE: `inventoryQty` is a synced snapshot for display/search only. The agent
 * MUST re-check live inventory at answer time (M4/M6) — never promise stock from
 * this column, or you will sell sold-out variants.
 */
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuidPk(),
    productId: uuid()
      .notNull()
      .references(() => products.id),
    brandId: uuid()
      .notNull()
      .references(() => brands.id),
    shopifyVariantId: text(),
    title: text(),
    sku: text(),
    priceCents: integer(),
    inventoryQty: integer(),
    options: jsonb().$type<VariantOptions>(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("product_variants_brand_idx").on(t.brandId),
    index("product_variants_product_idx").on(t.productId),
  ],
);
