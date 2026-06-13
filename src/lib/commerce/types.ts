/**
 * Commerce adapter interface. Shopify is the V1 implementation; the interface
 * keeps it swappable. Every method is brand-scoped.
 *
 * HARD INVARIANT: stock and price come from LIVE reads at answer time
 * (`getVariantLive`, `getOrderStatus`), never from the synced snapshot or RAG.
 */

export type VariantLive = {
  variantId: string;
  title: string | null;
  priceCents: number;
  inventoryQty: number;
  available: boolean;
  options: Record<string, string>;
};

export type CatalogHit = {
  /** Product hit ref; null for policy hits. */
  productId: string | null;
  variantId: string | null;
  title: string;
  sourceType: "catalog" | "policy";
  snippet: string;
  /** Lower is closer (cosine distance); null for pure keyword hits. */
  distance: number | null;
};

export type OrderStatus = {
  orderId: string;
  shopifyOrderId: string | null;
  status: string | null;
  fulfillmentStatus: "unfulfilled" | "fulfilled" | "partial";
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
};

export type OrderSummary = {
  orderId: string;
  shopifyOrderId: string | null;
  totalCents: number | null;
  fulfillmentStatus: "unfulfilled" | "fulfilled" | "partial";
  createdAt: Date;
};

export interface CommerceProvider {
  // --- Sync (snapshot into our tables) ---
  syncCatalog(brandId: string): Promise<{ products: number; variants: number }>;
  syncCustomers(brandId: string): Promise<number>;
  syncOrders(brandId: string, opts?: { sinceDays?: number }): Promise<number>;

  // --- LIVE reads (never cached for stock/price) ---
  getVariantLive(brandId: string, variantId: string): Promise<VariantLive | null>;
  searchCatalog(brandId: string, query: string, opts?: { limit?: number }): Promise<CatalogHit[]>;
  getOrderStatus(brandId: string, orderRef: string): Promise<OrderStatus | null>;
  getCustomerHistory(brandId: string, customerId: string): Promise<OrderSummary[]>;

  // --- Side-effects (implemented in M8; signature only here) ---
  createCheckoutLink(
    brandId: string,
    lineItems: Array<{ variantId: string; quantity: number }>,
    opts?: { discountCode?: string },
  ): Promise<{ url: string }>;
}
