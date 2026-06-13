import type { SyncCustomer, SyncOrder, SyncProduct } from "./sync-upserts";

/**
 * Self-contained mock "Shopify store" used by MockCommerce when no real Shopify
 * credentials are configured — so the full sync → embed → search → live-read path
 * is exercisable in dev and tests without a real store. Prices already in cents.
 */

const DELIVERED = new Date("2026-06-01T12:00:00Z");
const SHIPPED = new Date("2026-05-30T12:00:00Z");

export const MOCK_PRODUCTS: SyncProduct[] = [
  {
    shopifyProductId: "gid://mock/Product/1",
    title: "Trailhead Rain Shell",
    description: "A packable, fully seam-sealed waterproof jacket for shoulder-season hikes.",
    status: "active",
    variants: [
      {
        shopifyVariantId: "gid://mock/Variant/11",
        title: "Black / M",
        sku: "TRAIL-BLK-M",
        priceCents: 12900,
        inventoryQty: 8,
        options: { color: "Black", size: "M" },
      },
      {
        shopifyVariantId: "gid://mock/Variant/12",
        title: "Black / L",
        sku: "TRAIL-BLK-L",
        priceCents: 12900,
        inventoryQty: 0, // sold out — for stock handling
        options: { color: "Black", size: "L" },
      },
    ],
  },
  {
    shopifyProductId: "gid://mock/Product/2",
    title: "Drift Linen Shirt",
    description: "A breathable European-linen shirt with a relaxed camp collar.",
    status: "active",
    variants: [
      {
        shopifyVariantId: "gid://mock/Variant/21",
        title: "Sand / M",
        sku: "DRIFT-SND-M",
        priceCents: 6400,
        inventoryQty: 15,
        options: { color: "Sand", size: "M" },
      },
    ],
  },
  {
    shopifyProductId: "gid://mock/Product/3",
    title: "Summit Wool Beanie",
    description: "A two-ply merino beanie that layers under a hood without bulk.",
    status: "active",
    variants: [
      {
        shopifyVariantId: "gid://mock/Variant/31",
        title: "Charcoal / OS",
        sku: "SUMMIT-CHR-OS",
        priceCents: 3200,
        inventoryQty: 40,
        options: { color: "Charcoal", size: "One Size" },
      },
    ],
  },
];

export const MOCK_CUSTOMERS: SyncCustomer[] = [
  {
    shopifyCustomerId: "gid://mock/Customer/1",
    phoneE164: "+15550111001",
    name: "Avery Stone",
    email: "avery@mock.test",
  },
  {
    shopifyCustomerId: "gid://mock/Customer/2",
    phoneE164: "+15550111002",
    name: "Blair Quinn",
    email: "blair@mock.test",
  },
  {
    // No phone → unreachable by SMS, must be skipped on sync.
    shopifyCustomerId: "gid://mock/Customer/3",
    phoneE164: null,
    name: "No Phone",
    email: "nophone@mock.test",
  },
];

export const MOCK_ORDERS: SyncOrder[] = [
  {
    shopifyOrderId: "gid://mock/Order/1",
    shopifyCustomerId: "gid://mock/Customer/1",
    status: "#M1001",
    totalCents: 12900,
    fulfillmentStatus: "fulfilled",
    trackingNumber: "1ZMOCK0000001",
    carrier: "UPS",
    shippedAt: SHIPPED,
    deliveredAt: DELIVERED,
    lineItems: [
      {
        shopifyVariantId: "gid://mock/Variant/11",
        title: "Trailhead Rain Shell — Black / M",
        qty: 1,
        priceCents: 12900,
      },
    ],
  },
  {
    shopifyOrderId: "gid://mock/Order/2",
    shopifyCustomerId: "gid://mock/Customer/2",
    status: "#M1002",
    totalCents: 9600,
    fulfillmentStatus: "unfulfilled",
    trackingNumber: null,
    carrier: null,
    shippedAt: null,
    deliveredAt: null,
    lineItems: [
      {
        shopifyVariantId: "gid://mock/Variant/21",
        title: "Drift Linen Shirt — Sand / M",
        qty: 1,
        priceCents: 6400,
      },
      {
        shopifyVariantId: "gid://mock/Variant/31",
        title: "Summit Wool Beanie — Charcoal / OS",
        qty: 1,
        priceCents: 3200,
      },
    ],
  },
];
