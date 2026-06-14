import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { orders, productVariants } from "@/lib/db/schema";
import { BaseCommerce } from "./base";
import { MOCK_CUSTOMERS, MOCK_ORDERS, MOCK_PRODUCTS } from "./fixtures";
import {
  upsertCustomer,
  upsertOrder,
  upsertProduct,
  type SyncCustomer,
  type SyncOrder,
  type SyncProduct,
} from "./sync-upserts";
import type { OrderStatus, VariantLive } from "./types";

type Fixtures = { products: SyncProduct[]; customers: SyncCustomer[]; orders: SyncOrder[] };

/**
 * Mock commerce provider used when no Shopify credentials are configured. It syncs
 * fixture data through the SAME upserts as the real provider, and — crucially —
 * `getVariantLive`/`getOrderStatus` read from a mutable in-memory "live" source,
 * NOT the synced DB snapshot. Tests mutate that source to prove live reads reflect
 * Shopify-side changes without re-syncing.
 */
export class MockCommerce extends BaseCommerce {
  private readonly fixtures: Fixtures;
  private readonly liveInventory = new Map<string, { priceCents: number; inventoryQty: number }>();

  constructor(fixtures?: Partial<Fixtures>) {
    super();
    this.fixtures = {
      products: fixtures?.products ?? MOCK_PRODUCTS,
      customers: fixtures?.customers ?? MOCK_CUSTOMERS,
      orders: fixtures?.orders ?? MOCK_ORDERS,
    };
    for (const p of this.fixtures.products) {
      for (const v of p.variants) {
        this.liveInventory.set(v.shopifyVariantId, {
          priceCents: v.priceCents ?? 0,
          inventoryQty: v.inventoryQty ?? 0,
        });
      }
    }
  }

  /** Test hook: simulate a stock/price change on the "Shopify" side (not the DB snapshot). */
  setLiveInventory(shopifyVariantId: string, inventoryQty: number, priceCents?: number): void {
    const current = this.liveInventory.get(shopifyVariantId) ?? { priceCents: 0, inventoryQty: 0 };
    this.liveInventory.set(shopifyVariantId, {
      priceCents: priceCents ?? current.priceCents,
      inventoryQty,
    });
  }

  async syncCatalog(brandId: string): Promise<{ products: number; variants: number }> {
    let variants = 0;
    for (const p of this.fixtures.products) variants += (await upsertProduct(brandId, p)).variants;
    return { products: this.fixtures.products.length, variants };
  }

  async syncCustomers(brandId: string): Promise<number> {
    let count = 0;
    for (const c of this.fixtures.customers) if (await upsertCustomer(brandId, c)) count += 1;
    return count;
  }

  async syncOrders(brandId: string): Promise<number> {
    let count = 0;
    for (const o of this.fixtures.orders) if (await upsertOrder(brandId, o)) count += 1;
    return count;
  }

  async getVariantLive(brandId: string, variantId: string): Promise<VariantLive | null> {
    // DB is used ONLY to map our internal id -> the Shopify variant id + display
    // fields. The stock/price come from the live map, never productVariants.inventoryQty.
    const row = await db
      .select({
        shopifyVariantId: productVariants.shopifyVariantId,
        title: productVariants.title,
        options: productVariants.options,
      })
      .from(productVariants)
      .where(and(eq(productVariants.brandId, brandId), eq(productVariants.id, variantId)))
      .limit(1);
    const sv = row[0]?.shopifyVariantId;
    if (!sv) return null;
    const live = this.liveInventory.get(sv);
    if (!live) return null;
    return {
      variantId,
      title: row[0]?.title ?? null,
      priceCents: live.priceCents,
      inventoryQty: live.inventoryQty,
      available: live.inventoryQty > 0,
      options: row[0]?.options ?? {},
    };
  }

  async getOrderStatus(brandId: string, orderRef: string): Promise<OrderStatus | null> {
    const row = await db
      .select({ id: orders.id, shopifyOrderId: orders.shopifyOrderId })
      .from(orders)
      .where(and(eq(orders.brandId, brandId), eq(orders.id, orderRef)))
      .limit(1);
    const order = row[0];
    if (!order?.shopifyOrderId) return null;
    const fixture = this.fixtures.orders.find((o) => o.shopifyOrderId === order.shopifyOrderId);
    if (!fixture) return null;
    return {
      orderId: order.id,
      shopifyOrderId: order.shopifyOrderId,
      status: fixture.status,
      fulfillmentStatus: fixture.fulfillmentStatus,
      trackingNumber: fixture.trackingNumber,
      carrier: fixture.carrier,
      shippedAt: fixture.shippedAt,
      deliveredAt: fixture.deliveredAt,
    };
  }

  /** A deterministic mock cart permalink (carries the attribution discount code) — the
   * keyless equivalent of the real Shopify cart link the customer would pay. */
  async createCheckoutLink(
    _brandId: string,
    lineItems: Array<{ variantId: string; quantity: number }>,
    opts?: { discountCode?: string },
  ): Promise<{ url: string }> {
    const items = lineItems.map((li) => `${li.variantId}:${Math.max(1, li.quantity)}`).join(",");
    const query = opts?.discountCode ? `?discount=${encodeURIComponent(opts.discountCode)}` : "";
    return { url: `https://demo-apparel.example/cart/${items}${query}` };
  }
}
