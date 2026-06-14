import type { AgentBrand, ProposalStore } from "@/lib/agent/types";
import type {
  CatalogHit,
  CommerceProvider,
  OrderStatus,
  OrderSummary,
  VariantLive,
} from "@/lib/commerce/types";

/**
 * Self-contained fixtures for the eval harness — a believable brand + catalog +
 * orders, served entirely in memory so `pnpm eval` runs without a database, Shopify,
 * or any seed. The agent's tools are pointed at these via an injected ToolContext.
 */

export const EVAL_BRAND: AgentBrand = {
  id: "eval-brand",
  name: "Demo Apparel Co",
  voice: {
    agentName: "Riley",
    toneExemplars: [
      "Totally get it — let's find the size that actually works for you.",
      "Happy to help! Want me to set up an exchange for the next size up?",
    ],
    bannedPhrases: ["delve", "game-changer", "elevate your wardrobe"],
    formality: "casual",
  },
  policies: {
    returns: "Free returns within 30 days of delivery on unworn items with tags attached.",
    shipping: "Free standard shipping over $75; orders ship in 1–2 business days.",
    exchange:
      "Free size and color exchanges within 30 days — we send the new item before you return the old one.",
  },
};

type FVariant = {
  variantId: string;
  title: string;
  priceCents: number;
  inventoryQty: number;
  options: Record<string, string>;
};
type FProduct = { productId: string; title: string; keywords: string[]; variants: FVariant[] };

const PRODUCTS: FProduct[] = [
  {
    productId: "p-jacket",
    title: "Summit Rain Jacket",
    keywords: ["rain", "jacket", "waterproof", "coat", "summit"],
    variants: [
      {
        variantId: "v-jacket-m",
        title: "Summit Rain Jacket / M",
        priceCents: 12900,
        inventoryQty: 8,
        options: { size: "M" },
      },
      {
        variantId: "v-jacket-s",
        title: "Summit Rain Jacket / S",
        priceCents: 12900,
        inventoryQty: 0,
        options: { size: "S" },
      },
    ],
  },
  {
    productId: "p-tee",
    title: "Everyday Cotton Tee",
    keywords: ["tee", "tshirt", "t-shirt", "shirt", "cotton"],
    variants: [
      {
        variantId: "v-tee-m",
        title: "Everyday Cotton Tee / M",
        priceCents: 3200,
        inventoryQty: 42,
        options: { size: "M" },
      },
    ],
  },
  {
    productId: "p-clog",
    title: "Limited Garden Clog",
    keywords: ["clog", "garden", "shoe", "clogs"],
    variants: [
      {
        variantId: "v-clog",
        title: "Limited Garden Clog",
        priceCents: 5500,
        inventoryQty: 0,
        options: {},
      },
    ],
  },
];

const ORDERS = [
  {
    orderId: "o-1001",
    shopifyOrderId: "S1001",
    status: "fulfilled",
    fulfillmentStatus: "fulfilled" as const,
    trackingNumber: "1Z999AA10123456784",
    carrier: "UPS",
    shippedAt: new Date("2026-06-09T15:00:00Z"),
    deliveredAt: null,
    totalCents: 12900,
    createdAt: new Date("2026-06-07T12:00:00Z"),
  },
];

function findVariant(variantId: string): FVariant | undefined {
  for (const p of PRODUCTS) for (const v of p.variants) if (v.variantId === variantId) return v;
  return undefined;
}

/** A pure in-memory CommerceProvider over the fixtures above. */
export const fixtureCommerce: CommerceProvider = {
  async syncCatalog() {
    return { products: PRODUCTS.length, variants: PRODUCTS.flatMap((p) => p.variants).length };
  },
  async syncCustomers() {
    return 0;
  },
  async syncOrders() {
    return ORDERS.length;
  },

  async searchCatalog(_brandId, query, opts): Promise<CatalogHit[]> {
    const q = query.toLowerCase();
    const limit = opts?.limit ?? 5;
    const hits: CatalogHit[] = [];
    if (/\b(return|refund|ship|shipping|exchange|policy|warranty)\b/.test(q)) {
      hits.push({
        productId: null,
        variantId: null,
        title: "Policy",
        sourceType: "policy",
        snippet: "Brand policy",
        distance: null,
      });
    }
    for (const p of PRODUCTS) {
      if (p.keywords.some((k) => q.includes(k)) || q.includes(p.title.toLowerCase())) {
        hits.push({
          productId: p.productId,
          variantId: null,
          title: p.title,
          sourceType: "catalog",
          snippet: p.title,
          distance: 0.1,
        });
      }
    }
    return hits.slice(0, limit);
  },

  async getVariantLive(_brandId, variantId): Promise<VariantLive | null> {
    const v = findVariant(variantId);
    if (!v) return null;
    return {
      variantId: v.variantId,
      title: v.title,
      priceCents: v.priceCents,
      inventoryQty: v.inventoryQty,
      available: v.inventoryQty > 0,
      options: v.options,
    };
  },

  async getOrderStatus(_brandId, orderRef): Promise<OrderStatus | null> {
    const o = ORDERS.find((x) => x.orderId === orderRef);
    if (!o) return null;
    return {
      orderId: o.orderId,
      shopifyOrderId: o.shopifyOrderId,
      status: o.status,
      fulfillmentStatus: o.fulfillmentStatus,
      trackingNumber: o.trackingNumber,
      carrier: o.carrier,
      shippedAt: o.shippedAt,
      deliveredAt: o.deliveredAt,
    };
  },

  async getCustomerHistory(): Promise<OrderSummary[]> {
    return ORDERS.map((o) => ({
      orderId: o.orderId,
      shopifyOrderId: o.shopifyOrderId,
      totalCents: o.totalCents,
      fulfillmentStatus: o.fulfillmentStatus,
      createdAt: o.createdAt,
    }));
  },

  async createCheckoutLink() {
    return { url: "https://demo-apparel.example/checkout/eval" };
  },
};

/** Variant identity (no stock/price) for the list_variants tool. */
export async function fixtureListVariants(productId: string) {
  const p = PRODUCTS.find((x) => x.productId === productId);
  return (p?.variants ?? []).map((v) => ({
    variantId: v.variantId,
    title: v.title,
    options: v.options,
  }));
}

/** In-memory propose-only store. Records proposals so the harness can assert on them
 * while guaranteeing nothing is executed. */
export function createProposalSink() {
  const created: Array<{ id: string; type: string }> = [];
  const store: ProposalStore = {
    async getOpen() {
      const open = created[0];
      return open ? { id: open.id } : undefined;
    },
    async create(_brandId, data) {
      const action = { id: `pa-${created.length + 1}`, type: data.type };
      created.push(action);
      return { id: action.id };
    },
  };
  return { store, created };
}
