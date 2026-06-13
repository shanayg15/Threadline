import { env } from "@/lib/config/env";
import * as integrations from "@/lib/db/repos/integrations";

// Shopify ships quarterly date-versioned APIs (YYYY-MM). Verify the current stable
// version in Shopify's docs and set SHOPIFY_API_VERSION; this is only the fallback.
export const DEFAULT_API_VERSION = "2026-01";

export type ShopifyCreds = {
  shopDomain: string;
  accessToken: string;
  apiVersion: string;
  webhookSecret: string | null;
};

type StoredCreds = Partial<
  Record<"shopDomain" | "accessToken" | "apiVersion" | "webhookSecret", string>
>;

/**
 * Resolve a brand's Shopify credentials: prefer the per-brand encrypted
 * `integrations` row; fall back to the single-store SHOPIFY_* env for dev. Returns
 * null when no credentials are configured (the factory then uses the mock provider).
 * Credentials are never logged.
 */
export async function resolveShopifyCreds(brandId: string): Promise<ShopifyCreds | null> {
  try {
    const raw = await integrations.getDecryptedCredentials(brandId, "shopify");
    if (raw) {
      const c = JSON.parse(raw) as StoredCreds;
      if (c.shopDomain && c.accessToken) {
        return {
          shopDomain: c.shopDomain,
          accessToken: c.accessToken,
          apiVersion: c.apiVersion ?? env.SHOPIFY_API_VERSION ?? DEFAULT_API_VERSION,
          webhookSecret: c.webhookSecret ?? env.SHOPIFY_WEBHOOK_SECRET ?? null,
        };
      }
    }
  } catch {
    // malformed/absent integration creds — fall through to env
  }

  if (env.SHOPIFY_SHOP_DOMAIN && env.SHOPIFY_ADMIN_ACCESS_TOKEN) {
    return {
      shopDomain: env.SHOPIFY_SHOP_DOMAIN,
      accessToken: env.SHOPIFY_ADMIN_ACCESS_TOKEN,
      apiVersion: env.SHOPIFY_API_VERSION ?? DEFAULT_API_VERSION,
      webhookSecret: env.SHOPIFY_WEBHOOK_SECRET ?? null,
    };
  }
  return null;
}
