import { createHmac, timingSafeEqual } from "node:crypto";

import type { SyncCustomer, SyncOrder, SyncProduct } from "./sync-upserts";

/**
 * Pure Shopify-webhook parsing/verification — no DB, Redis, or env imports, so it
 * is unit-testable in isolation. The stateful dispatch lives in ./webhooks.
 */

/**
 * Verify a Shopify webhook HMAC against the RAW request body. MUST run on the raw
 * text before any JSON parsing (re-serializing changes the bytes). Constant-time.
 */
export function verifyShopifyHmac(
  rawBody: string,
  hmacHeader: string | null,
  secret: string,
): boolean {
  if (!hmacHeader) return false;
  // Compare the decoded signature BYTES (robust to base64 padding/whitespace), in
  // constant time. The length guard keeps timingSafeEqual from throwing.
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  const provided = Buffer.from(hmacHeader.trim(), "base64");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export function centsFrom(price: string | number | null | undefined): number | null {
  if (price == null) return null;
  const n = typeof price === "number" ? price : Number.parseFloat(price);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function restFulfillment(
  status: string | null | undefined,
): "unfulfilled" | "fulfilled" | "partial" {
  if (status === "fulfilled") return "fulfilled";
  if (status === "partial") return "partial";
  return "unfulfilled";
}

// ---- REST webhook payload shapes ----
export type RestVariant = {
  id: number;
  title?: string | null;
  sku?: string | null;
  price?: string | null;
  inventory_quantity?: number | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
};
export type RestProduct = {
  id: number;
  title: string;
  body_html?: string | null;
  status?: string | null;
  options?: Array<{ name: string; position: number }>;
  variants?: RestVariant[];
};
export type RestCustomer = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
};
export type RestOrder = {
  id: number;
  name?: string | null;
  total_price?: string | null;
  fulfillment_status?: string | null;
  customer?: { id: number } | null;
  /** Discount codes applied at checkout — the attribution token (M8) rides here. */
  discount_codes?: Array<{ code?: string | null }> | null;
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

/** The discount codes on an order, uppercased (M8 attribution matching). */
export function orderDiscountCodes(o: RestOrder): string[] {
  return (o.discount_codes ?? [])
    .map((d) => d.code?.trim().toUpperCase())
    .filter((c): c is string => Boolean(c));
}

// REST webhooks use numeric ids; normalize to gid form so they reconcile with the
// GraphQL sync rows (which key on gid://shopify/...).
export function mapWebhookProduct(p: RestProduct): SyncProduct {
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

export function mapWebhookCustomer(c: RestCustomer): SyncCustomer {
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || null;
  return {
    shopifyCustomerId: `gid://shopify/Customer/${c.id}`,
    phoneE164: c.phone ?? null,
    name,
    email: c.email ?? null,
  };
}

// Shopify's fulfillments/update webhook delivers a FULFILLMENT, not an order: its
// top-level `id` is the fulfillment id; the order is referenced via `order_id`.
export type RestFulfillment = {
  id: number;
  order_id: number;
  tracking_number?: string | null;
  tracking_company?: string | null;
  created_at?: string | null;
};

export function fulfillmentOrderGid(f: RestFulfillment): string {
  return `gid://shopify/Order/${f.order_id}`;
}

export function mapWebhookOrder(o: RestOrder): SyncOrder {
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
