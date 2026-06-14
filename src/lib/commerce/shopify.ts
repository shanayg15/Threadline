import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { orders, productVariants } from "@/lib/db/schema";
import { BaseCommerce } from "./base";
import { resolveShopifyCreds, type ShopifyCreds } from "./credentials";
import {
  upsertCustomer,
  upsertOrder,
  upsertProduct,
  type SyncOrder,
  type SyncProduct,
} from "./sync-upserts";
import type { OrderStatus, VariantLive } from "./types";

const MAX_RETRIES = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function priceToCents(price: string | null | undefined): number | null {
  if (price == null) return null;
  const n = Number.parseFloat(price);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function mapFulfillment(
  status: string | null | undefined,
): "unfulfilled" | "fulfilled" | "partial" {
  switch (status) {
    case "FULFILLED":
      return "fulfilled";
    case "PARTIALLY_FULFILLED":
      return "partial";
    default:
      return "unfulfilled";
  }
}

function optionsFrom(selected: Array<{ name: string; value: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const o of selected) out[o.name.toLowerCase()] = o.value;
  return out;
}

// ---- Shopify response shapes ----
type Edge<T> = { node: T };
type Page<T> = { edges: Edge<T>[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
type SelectedOption = { name: string; value: string };
type Fulfillment = {
  createdAt: string | null;
  deliveredAt: string | null;
  trackingInfo: Array<{ number: string | null; company: string | null }>;
};

type VariantNode = {
  id: string;
  title: string | null;
  sku: string | null;
  price: string | null;
  inventoryQuantity: number | null;
  selectedOptions: SelectedOption[];
};
type ProductNode = {
  id: string;
  title: string;
  descriptionHtml: string | null;
  status: string;
  variants: { edges: Edge<VariantNode>[] };
};
type CustomerNode = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
};
type OrderNode = {
  id: string;
  name: string;
  displayFulfillmentStatus: string | null;
  currentTotalPriceSet: { shopMoney: { amount: string } } | null;
  customer: { id: string } | null;
  createdAt: string;
  fulfillments: Fulfillment[];
  lineItems: {
    edges: Edge<{
      title: string | null;
      quantity: number;
      variant: { id: string; price: string | null } | null;
    }>[];
  };
};

type ProductsResponse = { products: Page<ProductNode> };
type CustomersResponse = { customers: Page<CustomerNode> };
type OrdersResponse = { orders: Page<OrderNode> };
type VariantLiveResponse = {
  node: (VariantNode & { availableForSale: boolean }) | null;
};
type OrderStatusResponse = {
  node: {
    id: string;
    name: string;
    displayFulfillmentStatus: string | null;
    fulfillments: Fulfillment[];
  } | null;
};

type ThrottleStatus = { currentlyAvailable: number; restoreRate: number };
type GraphQLEnvelope<T> = {
  data?: T;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
  extensions?: { cost?: { throttleStatus?: ThrottleStatus } };
};

/**
 * Minimal Shopify Admin GraphQL client: auth header, pinned API version, cursor
 * pagination, and cost-aware rate-limit handling (backoff + retry on HTTP 429 and
 * GraphQL THROTTLED). Never logs the access token or response bodies verbatim.
 */
export class ShopifyGraphQLClient {
  private readonly endpoint: string;
  private readonly accessToken: string;
  readonly shopDomain: string;

  constructor(creds: ShopifyCreds) {
    this.endpoint = `https://${creds.shopDomain}/admin/api/${creds.apiVersion}/graphql.json`;
    this.accessToken = creds.accessToken;
    this.shopDomain = creds.shopDomain;
  }

  async request<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": this.accessToken,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (res.status === 429) {
        const retryAfter = Number.parseFloat(res.headers.get("Retry-After") ?? "2");
        await sleep((Number.isFinite(retryAfter) ? retryAfter : 2) * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`Shopify Admin API HTTP ${res.status}`);

      const json = (await res.json()) as GraphQLEnvelope<T>;
      const throttled = json.errors?.some((e) => e.extensions?.code === "THROTTLED");
      if (throttled) {
        // Wait for the cost budget to restore: time ≈ deficit / restoreRate.
        const status = json.extensions?.cost?.throttleStatus;
        const restoreRate = status?.restoreRate ?? 50;
        const available = status?.currentlyAvailable ?? 0;
        const deficit = Math.max(0, 1000 - available);
        const waitMs = Math.min(
          10_000,
          Math.max(1000, (deficit / Math.max(1, restoreRate)) * 1000),
        );
        await sleep(waitMs);
        continue;
      }
      if (json.errors?.length) {
        throw new Error(`Shopify GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`);
      }
      if (!json.data) throw new Error("Shopify GraphQL: empty response");
      return json.data;
    }
    throw new Error("Shopify Admin API: exceeded retry budget (rate limited)");
  }
}

const PRODUCTS_QUERY = /* GraphQL */ `
  query Products($cursor: String) {
    products(first: 50, after: $cursor) {
      edges {
        node {
          id
          title
          descriptionHtml
          status
          variants(first: 100) {
            edges {
              node {
                id
                title
                sku
                price
                inventoryQuantity
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const CUSTOMERS_QUERY = /* GraphQL */ `
  query Customers($cursor: String) {
    customers(first: 100, after: $cursor) {
      edges {
        node {
          id
          firstName
          lastName
          email
          phone
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const ORDERS_QUERY = /* GraphQL */ `
  query Orders($cursor: String, $query: String) {
    orders(first: 50, after: $cursor, query: $query) {
      edges {
        node {
          id
          name
          displayFulfillmentStatus
          currentTotalPriceSet {
            shopMoney {
              amount
            }
          }
          customer {
            id
          }
          createdAt
          fulfillments(first: 5) {
            createdAt
            deliveredAt
            trackingInfo {
              number
              company
            }
          }
          lineItems(first: 100) {
            edges {
              node {
                title
                quantity
                variant {
                  id
                  price
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const VARIANT_LIVE_QUERY = /* GraphQL */ `
  query Variant($id: ID!) {
    node(id: $id) {
      ... on ProductVariant {
        id
        title
        price
        inventoryQuantity
        availableForSale
        selectedOptions {
          name
          value
        }
      }
    }
  }
`;

const ORDER_STATUS_QUERY = /* GraphQL */ `
  query Order($id: ID!) {
    node(id: $id) {
      ... on Order {
        id
        name
        displayFulfillmentStatus
        fulfillments(first: 5) {
          createdAt
          deliveredAt
          trackingInfo {
            number
            company
          }
        }
      }
    }
  }
`;

/** Real Shopify provider. Stock & price come from LIVE node() reads, never the snapshot. */
export class ShopifyCommerce extends BaseCommerce {
  constructor(private readonly client: ShopifyGraphQLClient) {
    super();
  }

  async syncCatalog(brandId: string): Promise<{ products: number; variants: number }> {
    let cursor: string | null = null;
    let productCount = 0;
    let variantCount = 0;
    do {
      const data: ProductsResponse = await this.client.request<ProductsResponse>(PRODUCTS_QUERY, {
        cursor,
      });
      for (const { node } of data.products.edges) {
        const p: SyncProduct = {
          shopifyProductId: node.id,
          title: node.title,
          description: node.descriptionHtml,
          status: node.status === "ARCHIVED" ? "archived" : "active",
          variants: node.variants.edges.map(({ node: v }) => ({
            shopifyVariantId: v.id,
            title: v.title,
            sku: v.sku,
            priceCents: priceToCents(v.price),
            inventoryQty: v.inventoryQuantity ?? null,
            options: optionsFrom(v.selectedOptions),
          })),
        };
        const { variants } = await upsertProduct(brandId, p);
        productCount += 1;
        variantCount += variants;
      }
      cursor = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
    } while (cursor);
    return { products: productCount, variants: variantCount };
  }

  async syncCustomers(brandId: string): Promise<number> {
    let cursor: string | null = null;
    let count = 0;
    do {
      const data: CustomersResponse = await this.client.request<CustomersResponse>(
        CUSTOMERS_QUERY,
        { cursor },
      );
      for (const { node } of data.customers.edges) {
        const name = [node.firstName, node.lastName].filter(Boolean).join(" ") || null;
        const synced = await upsertCustomer(brandId, {
          shopifyCustomerId: node.id,
          phoneE164: node.phone,
          name,
          email: node.email,
        });
        if (synced) count += 1;
      }
      cursor = data.customers.pageInfo.hasNextPage ? data.customers.pageInfo.endCursor : null;
    } while (cursor);
    return count;
  }

  async syncOrders(brandId: string, opts?: { sinceDays?: number }): Promise<number> {
    const queryFilter = opts?.sinceDays ? `created_at:>-${opts.sinceDays}d` : null;
    let cursor: string | null = null;
    let count = 0;
    do {
      const data: OrdersResponse = await this.client.request<OrdersResponse>(ORDERS_QUERY, {
        cursor,
        query: queryFilter,
      });
      for (const { node } of data.orders.edges) {
        const fulfillment = node.fulfillments[0];
        const tracking = fulfillment?.trackingInfo[0];
        const order: SyncOrder = {
          shopifyOrderId: node.id,
          shopifyCustomerId: node.customer?.id ?? null,
          status: node.name,
          totalCents: priceToCents(node.currentTotalPriceSet?.shopMoney.amount),
          fulfillmentStatus: mapFulfillment(node.displayFulfillmentStatus),
          trackingNumber: tracking?.number ?? null,
          carrier: tracking?.company ?? null,
          shippedAt: fulfillment?.createdAt ? new Date(fulfillment.createdAt) : null,
          deliveredAt: fulfillment?.deliveredAt ? new Date(fulfillment.deliveredAt) : null,
          lineItems: node.lineItems.edges.map(({ node: li }) => ({
            shopifyVariantId: li.variant?.id ?? null,
            title: li.title,
            qty: li.quantity,
            priceCents: priceToCents(li.variant?.price),
          })),
        };
        if (await upsertOrder(brandId, order)) count += 1;
      }
      cursor = data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor : null;
    } while (cursor);
    return count;
  }

  /**
   * Build a Shopify CART PERMALINK the customer pays — `/cart/{variantNumericId}:{qty},…`
   * with an optional `?discount=` attribution code. This is a link, NOT a charge: the
   * customer completes payment in Shopify's own checkout. No `write_*` scope needed
   * (a draft-order + invoice URL would be a richer alternative requiring write_draft_orders).
   */
  async createCheckoutLink(
    brandId: string,
    lineItems: Array<{ variantId: string; quantity: number }>,
    opts?: { discountCode?: string },
  ): Promise<{ url: string }> {
    const parts: string[] = [];
    for (const li of lineItems) {
      const row = await db
        .select({ shopifyVariantId: productVariants.shopifyVariantId })
        .from(productVariants)
        .where(and(eq(productVariants.brandId, brandId), eq(productVariants.id, li.variantId)))
        .limit(1);
      const numeric = row[0]?.shopifyVariantId?.split("/").pop();
      if (numeric) parts.push(`${numeric}:${Math.max(1, li.quantity)}`);
    }
    if (parts.length === 0) throw new Error("createCheckoutLink: no resolvable variants");
    const query = opts?.discountCode ? `?discount=${encodeURIComponent(opts.discountCode)}` : "";
    return { url: `https://${this.client.shopDomain}/cart/${parts.join(",")}${query}` };
  }

  // LIVE: resolve our internal variant id to its Shopify gid, then hit Shopify at
  // request time for current price + inventory. NEVER reads the synced snapshot.
  async getVariantLive(brandId: string, variantId: string): Promise<VariantLive | null> {
    const row = await db
      .select({ shopifyVariantId: productVariants.shopifyVariantId })
      .from(productVariants)
      .where(and(eq(productVariants.brandId, brandId), eq(productVariants.id, variantId)))
      .limit(1);
    const gid = row[0]?.shopifyVariantId;
    if (!gid) return null;

    const data = await this.client.request<VariantLiveResponse>(VARIANT_LIVE_QUERY, { id: gid });
    if (!data.node) return null;
    return {
      variantId,
      title: data.node.title,
      priceCents: priceToCents(data.node.price) ?? 0,
      // inventoryQuantity is the summed quantity across locations (informational);
      // availableForSale is the authoritative purchasability signal — trust it.
      inventoryQty: data.node.inventoryQuantity ?? 0,
      available: data.node.availableForSale,
      options: optionsFrom(data.node.selectedOptions),
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

    const data = await this.client.request<OrderStatusResponse>(ORDER_STATUS_QUERY, {
      id: order.shopifyOrderId,
    });
    if (!data.node) return null;
    const fulfillment = data.node.fulfillments[0];
    const tracking = fulfillment?.trackingInfo[0];
    return {
      orderId: order.id,
      shopifyOrderId: order.shopifyOrderId,
      status: data.node.name,
      fulfillmentStatus: mapFulfillment(data.node.displayFulfillmentStatus),
      trackingNumber: tracking?.number ?? null,
      carrier: tracking?.company ?? null,
      shippedAt: fulfillment?.createdAt ? new Date(fulfillment.createdAt) : null,
      deliveredAt: fulfillment?.deliveredAt ? new Date(fulfillment.deliveredAt) : null,
    };
  }
}

/** Build a Shopify provider for a brand, or null when no credentials are configured. */
export async function createShopifyCommerce(brandId: string): Promise<ShopifyCommerce | null> {
  const creds = await resolveShopifyCreds(brandId);
  if (!creds) return null;
  return new ShopifyCommerce(new ShopifyGraphQLClient(creds));
}
