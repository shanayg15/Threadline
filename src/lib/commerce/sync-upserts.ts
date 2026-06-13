import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { isUniqueViolation } from "@/lib/db/repos/_util";
import { customers, orderLineItems, orders, productVariants, products } from "@/lib/db/schema";

/**
 * Provider-agnostic upserts keyed by Shopify id. Both the real Shopify provider
 * and the mock provider normalize their source into these shapes (prices already
 * in integer cents) and call these — so sync + webhook handlers share one idempotent
 * path. ON CONFLICT targets the partial-unique (brandId, shopify*Id) indexes.
 */

export type SyncVariant = {
  shopifyVariantId: string;
  title: string | null;
  sku: string | null;
  priceCents: number | null;
  inventoryQty: number | null;
  options: Record<string, string>;
};

export type SyncProduct = {
  shopifyProductId: string;
  title: string;
  description: string | null;
  status: "active" | "archived";
  variants: SyncVariant[];
};

export type SyncCustomer = {
  shopifyCustomerId: string;
  phoneE164: string | null;
  name: string | null;
  email: string | null;
};

export type SyncOrderLineItem = {
  shopifyVariantId: string | null;
  title: string | null;
  qty: number;
  priceCents: number | null;
};

export type SyncOrder = {
  shopifyOrderId: string;
  shopifyCustomerId: string | null;
  status: string | null;
  totalCents: number | null;
  fulfillmentStatus: "unfulfilled" | "fulfilled" | "partial";
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  lineItems: SyncOrderLineItem[];
};

export async function upsertProduct(
  brandId: string,
  p: SyncProduct,
): Promise<{ variants: number }> {
  // NOTE: fitNotes is OUR agent metadata (edited in the console), never synced —
  // it is intentionally absent from both the insert and the update set so a
  // re-sync never wipes a human's fit notes.
  const [product] = await db
    .insert(products)
    .values({
      brandId,
      shopifyProductId: p.shopifyProductId,
      title: p.title,
      description: p.description,
      status: p.status,
    })
    .onConflictDoUpdate({
      target: [products.brandId, products.shopifyProductId],
      targetWhere: sql`${products.shopifyProductId} is not null`,
      set: { title: p.title, description: p.description, status: p.status, updatedAt: new Date() },
    })
    .returning({ id: products.id });

  const productId = product!.id;
  for (const v of p.variants) {
    await db
      .insert(productVariants)
      .values({
        brandId,
        productId,
        shopifyVariantId: v.shopifyVariantId,
        title: v.title,
        sku: v.sku,
        priceCents: v.priceCents,
        inventoryQty: v.inventoryQty,
        options: v.options,
      })
      .onConflictDoUpdate({
        target: [productVariants.brandId, productVariants.shopifyVariantId],
        targetWhere: sql`${productVariants.shopifyVariantId} is not null`,
        set: {
          productId,
          title: v.title,
          sku: v.sku,
          priceCents: v.priceCents,
          inventoryQty: v.inventoryQty,
          options: v.options,
          updatedAt: new Date(),
        },
      });
  }
  return { variants: p.variants.length };
}

/**
 * Upsert a synced customer. Skips customers with no phone (unreachable by SMS).
 * Consent is NEVER set here — a synced row defaults to consentStatus 'unknown' on
 * insert and is left untouched on update. Having a phone from Shopify is not consent.
 */
export async function upsertCustomer(brandId: string, c: SyncCustomer): Promise<boolean> {
  if (!c.phoneE164) return false;
  try {
    await db
      .insert(customers)
      .values({
        brandId,
        shopifyCustomerId: c.shopifyCustomerId,
        phoneE164: c.phoneE164,
        name: c.name,
        email: c.email,
      })
      .onConflictDoUpdate({
        target: [customers.brandId, customers.shopifyCustomerId],
        targetWhere: sql`${customers.shopifyCustomerId} is not null`,
        set: { phoneE164: c.phoneE164, name: c.name, email: c.email },
      });
    return true;
  } catch (err) {
    // Phone already belongs to another row (e.g. created via inbound SMS) — skip.
    if (isUniqueViolation(err)) return false;
    throw err;
  }
}

/** Upsert an order + its line items atomically. Requires the customer to be synced. */
export async function upsertOrder(brandId: string, o: SyncOrder): Promise<boolean> {
  let customerId: string | null = null;
  if (o.shopifyCustomerId) {
    const found = await db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(eq(customers.brandId, brandId), eq(customers.shopifyCustomerId, o.shopifyCustomerId)),
      )
      .limit(1);
    customerId = found[0]?.id ?? null;
  }
  if (!customerId) return false; // orders.customerId is NOT NULL

  await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        brandId,
        customerId,
        shopifyOrderId: o.shopifyOrderId,
        status: o.status,
        totalCents: o.totalCents,
        fulfillmentStatus: o.fulfillmentStatus,
        trackingNumber: o.trackingNumber,
        carrier: o.carrier,
        shippedAt: o.shippedAt,
        deliveredAt: o.deliveredAt,
      })
      .onConflictDoUpdate({
        target: [orders.brandId, orders.shopifyOrderId],
        targetWhere: sql`${orders.shopifyOrderId} is not null`,
        set: {
          customerId,
          status: o.status,
          totalCents: o.totalCents,
          fulfillmentStatus: o.fulfillmentStatus,
          trackingNumber: o.trackingNumber,
          carrier: o.carrier,
          shippedAt: o.shippedAt,
          deliveredAt: o.deliveredAt,
        },
      })
      .returning({ id: orders.id });

    const orderId = order!.id;
    await tx
      .delete(orderLineItems)
      .where(and(eq(orderLineItems.brandId, brandId), eq(orderLineItems.orderId, orderId)));

    if (o.lineItems.length > 0) {
      const rows = [];
      for (const li of o.lineItems) {
        let variantId: string | null = null;
        if (li.shopifyVariantId) {
          const v = await tx
            .select({ id: productVariants.id })
            .from(productVariants)
            .where(
              and(
                eq(productVariants.brandId, brandId),
                eq(productVariants.shopifyVariantId, li.shopifyVariantId),
              ),
            )
            .limit(1);
          variantId = v[0]?.id ?? null;
        }
        rows.push({
          brandId,
          orderId,
          variantId,
          title: li.title,
          qty: li.qty,
          priceCents: li.priceCents,
        });
      }
      await tx.insert(orderLineItems).values(rows);
    }
  });
  return true;
}
