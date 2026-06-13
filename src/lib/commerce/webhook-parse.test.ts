import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  centsFrom,
  fulfillmentOrderGid,
  mapWebhookCustomer,
  mapWebhookOrder,
  mapWebhookProduct,
  restFulfillment,
  verifyShopifyHmac,
} from "./webhook-parse";

const SECRET = "test-secret";
const sign = (body: string, secret = SECRET) =>
  createHmac("sha256", secret).update(body, "utf8").digest("base64");

describe("verifyShopifyHmac", () => {
  const body = JSON.stringify({ id: 1, title: "Jacket" });

  it("accepts a valid signature", () => {
    expect(verifyShopifyHmac(body, sign(body), SECRET)).toBe(true);
  });
  it("rejects a tampered body", () => {
    expect(verifyShopifyHmac(`${body} `, sign(body), SECRET)).toBe(false);
  });
  it("rejects a signature made with the wrong secret", () => {
    expect(verifyShopifyHmac(body, sign(body, "other-secret"), SECRET)).toBe(false);
  });
  it("rejects a missing header", () => {
    expect(verifyShopifyHmac(body, null, SECRET)).toBe(false);
  });
  it("tolerates trailing whitespace in the header (decoded-byte compare)", () => {
    expect(verifyShopifyHmac(body, `${sign(body)}\n`, SECRET)).toBe(true);
  });
});

describe("fulfillmentOrderGid", () => {
  it("derives the ORDER gid from order_id, not the fulfillment id", () => {
    // fulfillments/update payloads are fulfillment-shaped: top-level id is the
    // fulfillment, the order is order_id.
    expect(fulfillmentOrderGid({ id: 88001, order_id: 7001 })).toBe("gid://shopify/Order/7001");
  });
});

describe("centsFrom", () => {
  it("converts decimal price strings to integer cents", () => {
    expect(centsFrom("28.00")).toBe(2800);
    expect(centsFrom("128.99")).toBe(12899);
    expect(centsFrom(34.5)).toBe(3450);
  });
  it("returns null for absent prices", () => {
    expect(centsFrom(null)).toBe(null);
    expect(centsFrom(undefined)).toBe(null);
  });
});

describe("restFulfillment", () => {
  it("maps Shopify fulfillment_status to our enum", () => {
    expect(restFulfillment("fulfilled")).toBe("fulfilled");
    expect(restFulfillment("partial")).toBe("partial");
    expect(restFulfillment(null)).toBe("unfulfilled");
    expect(restFulfillment("anything-else")).toBe("unfulfilled");
  });
});

describe("mapWebhookProduct", () => {
  it("maps numeric ids to gid form, price to cents, and options", () => {
    const p = mapWebhookProduct({
      id: 9,
      title: "Jacket",
      body_html: "<p>warm</p>",
      status: "active",
      options: [
        { name: "Color", position: 1 },
        { name: "Size", position: 2 },
      ],
      variants: [
        {
          id: 91,
          title: "Black / M",
          sku: "J-B-M",
          price: "99.00",
          inventory_quantity: 5,
          option1: "Black",
          option2: "M",
        },
      ],
    });
    expect(p.shopifyProductId).toBe("gid://shopify/Product/9");
    const v = p.variants[0]!;
    expect(v.shopifyVariantId).toBe("gid://shopify/ProductVariant/91");
    expect(v.priceCents).toBe(9900);
    expect(v.inventoryQty).toBe(5);
    expect(v.options).toEqual({ color: "Black", size: "M" });
  });
});

describe("mapWebhookCustomer", () => {
  it("joins name and keeps phone (consent is set elsewhere)", () => {
    const c = mapWebhookCustomer({
      id: 5,
      first_name: "Avery",
      last_name: "Stone",
      phone: "+15551230000",
      email: "a@x.test",
    });
    expect(c.shopifyCustomerId).toBe("gid://shopify/Customer/5");
    expect(c.name).toBe("Avery Stone");
    expect(c.phoneE164).toBe("+15551230000");
  });
});

describe("mapWebhookOrder", () => {
  it("maps fulfillment, tracking, total, and line items; never sets deliveredAt", () => {
    const o = mapWebhookOrder({
      id: 7,
      name: "#7",
      total_price: "99.00",
      fulfillment_status: "fulfilled",
      customer: { id: 5 },
      fulfillments: [
        { tracking_number: "T1", tracking_company: "UPS", created_at: "2026-06-10T10:00:00Z" },
      ],
      line_items: [{ variant_id: 91, title: "Jacket — Black / M", quantity: 2, price: "49.50" }],
    });
    expect(o.shopifyOrderId).toBe("gid://shopify/Order/7");
    expect(o.shopifyCustomerId).toBe("gid://shopify/Customer/5");
    expect(o.fulfillmentStatus).toBe("fulfilled");
    expect(o.totalCents).toBe(9900);
    expect(o.trackingNumber).toBe("T1");
    expect(o.carrier).toBe("UPS");
    expect(o.deliveredAt).toBe(null); // delivered comes from tracking webhooks (M8)
    const li = o.lineItems[0]!;
    expect(li.shopifyVariantId).toBe("gid://shopify/ProductVariant/91");
    expect(li.qty).toBe(2);
    expect(li.priceCents).toBe(4950);
  });
});
