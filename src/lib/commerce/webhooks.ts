import { and, eq, sql } from "drizzle-orm";

import { env } from "@/lib/config/env";
import { db } from "@/lib/db/client";
import { decrypt } from "@/lib/db/crypto";
import * as eventsRepo from "@/lib/db/repos/events";
import { integrations, orders } from "@/lib/db/schema";
import { redis } from "@/lib/redis";
import { upsertCustomer, upsertOrder, upsertProduct } from "./sync-upserts";
import {
  mapWebhookCustomer,
  mapWebhookOrder,
  mapWebhookProduct,
  type RestCustomer,
  type RestOrder,
  type RestProduct,
} from "./webhook-parse";

// Re-export the pure verifier so callers (route + tests) import from one place.
export { verifyShopifyHmac } from "./webhook-parse";

/**
 * Resolve the brand + webhook secret for an incoming Shopify shop domain. The brand
 * is found via its `shopify` integration (shop domain stored, non-secret, in
 * metadata); the secret comes from the integration's encrypted creds, falling back
 * to env for single-store dev.
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
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  let secret = env.SHOPIFY_WEBHOOK_SECRET ?? null;
  if (row.ct) {
    try {
      const creds = JSON.parse(decrypt(row.ct)) as { webhookSecret?: string };
      if (creds.webhookSecret) secret = creds.webhookSecret;
    } catch {
      // fall back to env secret
    }
  }
  if (!secret) return null;
  return { brandId: row.brandId, webhookSecret: secret };
}

/** Dedupe by X-Shopify-Webhook-Id (Shopify reuses the id on retries). Redis NX+TTL.
 * Fails open if Redis is unreachable — the upserts are idempotent anyway. */
export async function isFirstDelivery(webhookId: string | null): Promise<boolean> {
  if (!webhookId) return true;
  try {
    const set = await redis.set(`shopify:webhook:${webhookId}`, "1", "EX", 86400, "NX");
    return set === "OK";
  } catch {
    return true;
  }
}

/**
 * Dispatch a verified webhook to the right idempotent upsert. For orders/fulfilled
 * and fulfillments/update it ALSO records an `order_fulfilled` event for M8's
 * lifecycle engine — and SENDS NOTHING (no outbound here).
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
    case "orders/updated":
      await upsertOrder(brandId, mapWebhookOrder(payload as RestOrder));
      return;

    case "orders/fulfilled":
    case "fulfillments/update": {
      const order = mapWebhookOrder(payload as RestOrder);
      await upsertOrder(brandId, order);
      const row = await db
        .select({ id: orders.id, customerId: orders.customerId })
        .from(orders)
        .where(and(eq(orders.brandId, brandId), eq(orders.shopifyOrderId, order.shopifyOrderId)))
        .limit(1);
      if (row[0]) {
        await eventsRepo.record(brandId, {
          type: "order_fulfilled",
          customerId: row[0].customerId,
          payload: { orderId: row[0].id, shopifyOrderId: order.shopifyOrderId },
        });
      }
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
