import { NextResponse, type NextRequest } from "next/server";

import {
  handleShopifyWebhook,
  isFirstDelivery,
  resolveWebhookContext,
  verifyShopifyHmac,
} from "@/lib/commerce/webhooks";

// node crypto + pg + redis; never cache. PUBLIC route (middleware excludes /api).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // RAW body — must be read and HMAC-verified BEFORE any JSON parsing.
  const rawBody = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  const topic = req.headers.get("x-shopify-topic");
  const shopDomain = req.headers.get("x-shopify-shop-domain");
  const webhookId = req.headers.get("x-shopify-webhook-id");

  if (!topic || !shopDomain) {
    return NextResponse.json({ error: "missing required headers" }, { status: 400 });
  }

  const ctx = await resolveWebhookContext(shopDomain);
  if (!ctx) {
    // No brand/secret for this shop — can't verify, reject.
    return NextResponse.json({ error: "unknown shop" }, { status: 401 });
  }

  if (!verifyShopifyHmac(rawBody, hmac, ctx.webhookSecret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // Idempotency: Shopify reuses the webhook id on retries.
  if (!(await isFirstDelivery(webhookId))) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  try {
    await handleShopifyWebhook(topic, ctx.brandId, payload);
  } catch (err) {
    // Never log the payload (could contain PII); surface a 500 so Shopify retries.
    console.error("[shopify-webhook]", topic, err instanceof Error ? err.message : "error");
    return NextResponse.json({ error: "handler error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
