import { createHmac, timingSafeEqual } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { env } from "@/lib/config/env";
import { db } from "@/lib/db/client";
import { decrypt } from "@/lib/db/crypto";
import * as eventsRepo from "@/lib/db/repos/events";
import { integrations, orders } from "@/lib/db/schema";
import { redis } from "@/lib/redis";
import {
  upsertCustomer,
  upsertOrder,
  upsertProduct,
  type SyncOrder,
  type SyncProduct,
} from "./sync-upserts";

/**
 * Verify a Shopify webhook HMAC against the RAW request body. MUST be called on
 * the raw text before JSON parsing — parsing/re-serializing changes the bytes and
 * breaks the signature. Constant-time comparison.
 */
export function verifyShopifyHmac(
  rawBody: string,
  hmacHeader: string | null,
  secret: string,
): boolean {
  if (!hmacHeader) return false;
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(hmacHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}

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

// ---- REST webhook payload mapping (numeric ids → gid form, matching GraphQL sync) ----

type RestVariant = {
  id: number;
  title?: string | null;
  sku?: string | null;
  price?: string | null;
  inventory_quantity?: number | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
};
type RestProduct = {
  id: number;
  title: string;
  body_html?: string | null;
  status?: string | null;
  options?: Array<{ name: string; position: number }>;
  variants?: RestVariant[];
};
type RestCustomer = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
};
type RestOrder = {
  id: number;
  name?: string | null;
  total_price?: string | null;
  fulfillment_status?: string | null;
  customer?: { id: number } | null;
  fulfillments?: Array<{
    tracking_number?: string | null;
    tracking_company?: string | null;
    created_at?: string | null;
  }>;
  line_items?: Array<{
    variant_id?: number | null;
    title?: string | null;
    quantity?: number | null;
    price?: string | null;
  }>;
};

function centsFrom(price: string | number | null | undefined): number | null {
  if (price == null) return null;
  const n = typeof price === "number" ? price : Number.parseFloat(price);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function restFulfillment(
  status: string | null | undefined,
): "unfulfilled" | "fulfilled" | "partial" {
  if (status === "fulfilled") return "fulfilled";
  if (status === "partial") return "partial";
  return "unfulfilled";
}

function mapWebhookProduct(p: RestProduct): SyncProduct {
  const optionNames = (p.options ?? []).sort((a, b) => a.position - b.position).map((o) => o.name);
  return {
    shopifyProductId: `gid://shopify/Product/${p.id}`,
    title: p.title,
    description: p.body_html ?? null,
    status: p.status === "archived" ? "archived" : "active",
    variants: (p.variants ?? []).map((v) => {
      const values = [v.option1, v.option2, v.option3];
      const options: Record<string, string> = {};
      optionNames.forEach((name, i) => {
        const val = values[i];
        if (val) options[name.toLowerCase()] = val;
      });
      return {
        shopifyVariantId: `gid://shopify/ProductVariant/${v.id}`,
        title: v.title ?? null,
        sku: v.sku ?? null,
        priceCents: centsFrom(v.price),
        inventoryQty: v.inventory_quantity ?? null,
        options,
      };
    }),
  };
}

function mapWebhookCustomer(c: RestCustomer) {
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || null;
  return {
    shopifyCustomerId: `gid://shopify/Customer/${c.id}`,
    phoneE164: c.phone ?? null,
    name,
    email: c.email ?? null,
  };
}

function mapWebhookOrder(o: RestOrder): SyncOrder {
  const fulfillment = o.fulfillments?.[0];
  return {
    shopifyOrderId: `gid://shopify/Order/${o.id}`,
    shopifyCustomerId: o.customer ? `gid://shopify/Customer/${o.customer.id}` : null,
    status: o.name ?? null,
    totalCents: centsFrom(o.total_price),
    fulfillmentStatus: restFulfillment(o.fulfillment_status),
    trackingNumber: fulfillment?.tracking_number ?? null,
    carrier: fulfillment?.tracking_company ?? null,
    shippedAt: fulfillment?.created_at ? new Date(fulfillment.created_at) : null,
    // Carrier "delivered" arrives via tracking webhooks (M8), not orders/fulfilled.
    deliveredAt: null,
    lineItems: (o.line_items ?? []).map((li) => ({
      shopifyVariantId: li.variant_id ? `gid://shopify/ProductVariant/${li.variant_id}` : null,
      title: li.title ?? null,
      qty: li.quantity ?? 1,
      priceCents: centsFrom(li.price),
    })),
  };
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
