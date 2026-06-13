import { MockCommerce } from "./mock";
import { createShopifyCommerce } from "./shopify";
import type { CommerceProvider } from "./types";

export type { CatalogHit, CommerceProvider, OrderStatus, OrderSummary, VariantLive } from "./types";

/**
 * Resolve the commerce provider for a brand: the real Shopify provider when
 * credentials are configured (per-brand `integrations` or the SHOPIFY_* env), else
 * the fixture-backed MockCommerce so dev/tests run without a real store.
 */
export async function getCommerceProvider(brandId: string): Promise<CommerceProvider> {
  const shopify = await createShopifyCommerce(brandId);
  return shopify ?? new MockCommerce();
}
