import * as ordersRepo from "@/lib/db/repos/orders";
import { searchCatalog as hybridSearch } from "@/lib/embeddings/search";
import type { CatalogHit, CommerceProvider, OrderStatus, OrderSummary, VariantLive } from "./types";

/**
 * Shared base for commerce providers. The DB-backed reads (hybrid catalog search,
 * customer history from synced orders) are identical across providers; only the
 * Shopify-API-hitting methods (sync*, live reads) differ.
 */
export abstract class BaseCommerce implements CommerceProvider {
  abstract syncCatalog(brandId: string): Promise<{ products: number; variants: number }>;
  abstract syncCustomers(brandId: string): Promise<number>;
  abstract syncOrders(brandId: string, opts?: { sinceDays?: number }): Promise<number>;
  abstract getVariantLive(brandId: string, variantId: string): Promise<VariantLive | null>;
  abstract getOrderStatus(brandId: string, orderRef: string): Promise<OrderStatus | null>;

  searchCatalog(brandId: string, query: string, opts?: { limit?: number }): Promise<CatalogHit[]> {
    return hybridSearch(brandId, query, opts);
  }

  async getCustomerHistory(brandId: string, customerId: string): Promise<OrderSummary[]> {
    const list = await ordersRepo.listForCustomer(brandId, customerId);
    return list.map((o) => ({
      orderId: o.id,
      shopifyOrderId: o.shopifyOrderId,
      totalCents: o.totalCents,
      fulfillmentStatus: o.fulfillmentStatus,
      createdAt: o.createdAt,
    }));
  }

  createCheckoutLink(
    brandId: string,
    lineItems: Array<{ variantId: string; quantity: number }>,
    opts?: { discountCode?: string },
  ): Promise<{ url: string }> {
    // Stubbed in M4; built in M8 (Shopify checkout links / draft-order invoices,
    // behind the pending-action confirmation gate). No card-on-file charging.
    throw new Error(
      `createCheckoutLink (brand ${brandId}, ${lineItems.length} items, ` +
        `discount ${opts?.discountCode ?? "none"}) is implemented in M8.`,
    );
  }
}
