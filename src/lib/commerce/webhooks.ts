import { and, eq, sql } from "drizzle-orm";

import { env } from "@/lib/config/env";
import { db } from "@/lib/db/client";
import { decrypt } from "@/lib/db/crypto";
import * as eventsRepo from "@/lib/db/repos/events";
import { integrations, orders } from "@/lib/db/schema";
import { redis } from "@/lib/redis";
import { recordOrderAttribution } from "@/lib/measure/attribution";
import { upsertCustomer, upsertOrder, upsertProduct } from "./sync-upserts";
import {
  fulfillmentOrderGid,
  mapWebhookCustomer,
  mapWebhookOrder,
  mapWebhookProduct,
  orderDiscountCodes,
  type RestCustomer,
  type RestFulfillment,
  type RestOrder,
  type RestProduct,
} from "./webhook-parse";

// Re-export the pure verifier so callers (route + tests) import from one place.
export { verifyShopifyHmac } from "./webhook-parse";

/**
 * Resolve the brand + webhook secret for an incoming Shopify shop domain. The brand
 * is found via its `shopify` integration (shop domain stored, non-secret, in
 * metadata). FAILS CLOSED if the domain is ambiguous (maps to 0 or >1 brands). The
 * per-brand secret comes from the integration's encrypted creds; the single-store
 * env secret is only borrowed when the env store IS this shop (never cross-brand).
 */
export async function resolveWebhookContext(
  shopDomain: string,
): Promise<{ brandId: string; webhookSecret: string } | null> {
  const rows = await db
    .select({ brandId: integrations.brandId, ct: integrations.credentialsCiphertext })
    .from(integrations)
    .where(
      and(
        eq(integrations.kind, "shopify"),
        sql`${integrations.metadata}->>'shopDomain' = ${shopDomain}`,
      ),
    )
    .limit(2);

  if (rows.length !== 1) return null; // unknown or ambiguous shop → fail closed
  const row = rows[0]!;

  let secret: string | null = null;
  if (row.ct) {
    try {
      const creds = JSON.parse(decrypt(row.ct)) as { webhookSecret?: string };
      if (creds.webhookSecret) secret = creds.webhookSecret;
    } catch {
      // corrupt per-brand creds → don't borrow another store's secret
    }
  }
  if (!secret && env.SHOPIFY_SHOP_DOMAIN === shopDomain) {
    secret = env.SHOPIFY_WEBHOOK_SECRET ?? null;
  }
  if (!secret) return null;
  return { brandId: row.brandId, webhookSecret: secret };
}

/** Fast-path dedupe by X-Shopify-Webhook-Id (Shopify reuses the id on retries),
 * brand-namespaced. Redis NX+TTL; fails open (the real idempotency guarantee is at
 * the DB: upserts ON CONFLICT and recordIfNew for events). */
export async function isFirstDelivery(brandId: string, webhookId: string | null): Promise<boolean> {
  if (!webhookId) return true;
  try {
    const set = await redis.set(`shopify:webhook:${brandId}:${webhookId}`, "1", "EX", 86400, "NX");
    return set === "OK";
  } catch {
    return true;
  }
}

/** Record an at-most-once order_fulfilled event for an order (idempotent across
 * retries and the orders/fulfilled + fulfillments/update double-topic). */
async function recordFulfilledEvent(brandId: string, shopifyOrderId: string): Promise<void> {
  const row = (
    await db
      .select({ id: orders.id, customerId: orders.customerId })
      .from(orders)
      .where(and(eq(orders.brandId, brandId), eq(orders.shopifyOrderId, shopifyOrderId)))
      .limit(1)
  )[0];
  if (!row) return;
  await eventsRepo.recordIfNew(brandId, {
    type: "order_fulfilled",
    customerId: row.customerId,
    dedupeKey: `order_fulfilled:${row.id}`,
    payload: { orderId: row.id, shopifyOrderId },
  });
}

/**
 * Dispatch a verified webhook to the right idempotent handler. orders/fulfilled and
 * fulfillments/update record an order_fulfilled event for M8's lifecycle engine —
 * and SEND NOTHING (no outbound here).
 */
export async function handleShopifyWebhook(
  topic: string,
  brandId: string,
  payload: unknown,
): Promise<void> {
  switch (topic) {
    case "products/create":
    case "products/update":
      await upsertProduct(brandId, mapWebhookProduct(payload as RestProduct));
      return;

    case "customers/create":
    case "customers/update":
      await upsertCustomer(brandId, mapWebhookCustomer(payload as RestCustomer));
      return;

    case "orders/create":
    case "orders/updated": {
      const restOrder = payload as RestOrder;
      const order = mapWebhookOrder(restOrder);
      await upsertOrder(brandId, order);
      // M8 attribution: if the order carries a conversation's attribution code, link it
      // back to that thread (idempotent — a retry won't re-attribute).
      await recordOrderAttribution(brandId, {
        shopifyOrderId: order.shopifyOrderId,
        discountCodes: orderDiscountCodes(restOrder),
        totalCents: order.totalCents,
      });
      return;
    }

    case "orders/fulfilled": {
      // Order-shaped payload.
      const order = mapWebhookOrder(payload as RestOrder);
      await upsertOrder(brandId, order);
      await recordFulfilledEvent(brandId, order.shopifyOrderId);
      return;
    }

    case "fulfillments/update": {
      // Fulfillment-shaped payload: the order is referenced via order_id.
      const f = payload as RestFulfillment;
      const orderGid = fulfillmentOrderGid(f);
      await db
        .update(orders)
        .set({
          trackingNumber: f.tracking_number ?? null,
          carrier: f.tracking_company ?? null,
          shippedAt: f.created_at ? new Date(f.created_at) : null,
        })
        .where(and(eq(orders.brandId, brandId), eq(orders.shopifyOrderId, orderGid)));
      await recordFulfilledEvent(brandId, orderGid);
      return;
    }

    case "inventory_levels/update":
      // No-op: the synced inventory snapshot is display-only and live reads always
      // hit Shopify (getVariantLive), so we don't chase inventory_item_id mappings here.
      return;

    default:
      // Unknown/unhandled topic — acknowledged at the route so Shopify won't retry.
      return;
  }
}
