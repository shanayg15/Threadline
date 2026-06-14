import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";

import { env } from "@/lib/config/env";
import { db, pool } from "@/lib/db/client";
import * as repos from "@/lib/db/repos";
import {
  brands,
  playbooks,
  productVariants,
  users,
  type Policies,
  type VoiceConfig,
} from "@/lib/db/schema";
import { one } from "@/lib/db/repos/_util";

/**
 * Idempotent dev seed: one believable demo apparel brand with catalog, customers,
 * and orders so later milestones can run without Shopify. Safe to run twice — the
 * brand and owner are upserted by natural key, and the bulk catalog/customers/
 * orders are created only if the brand has no products yet.
 *
 * Does NOT create knowledgeChunks — embeddings are an M4 concern.
 */

const BRAND_SLUG = "demo-apparel-co";
const OWNER_EMAIL = "owner@demo-apparel.example";
const OWNER_PASSWORD = "demo-password-123"; // dev-only, printed to console

// The brand's sending number routes inbound webhooks (resolveBrandByNumber matches
// channelConfig.phoneNumber against Twilio's `To`). Use the real Twilio number when
// configured, else a clearly-fake 555-01xx demo number so inbound works end-to-end.
const DEMO_PHONE_NUMBER = env.TWILIO_FROM_NUMBER ?? "+15555550100";
const DEMO_SUPPORT_CONTACT = "help@demo-apparel.example";
const CHANNEL_CONFIG = {
  provider: "twilio",
  phoneNumber: DEMO_PHONE_NUMBER,
  supportContact: DEMO_SUPPORT_CONTACT,
};

const VOICE: VoiceConfig = {
  agentName: "Riley",
  toneExemplars: [
    "Totally get it — let's find the size that actually works for you.",
    "Happy to help! That jacket runs a touch boxy, so if you're between sizes I'd size down.",
    "No worries at all. Want me to set up an exchange for the next size up?",
  ],
  bannedPhrases: ["delve", "game-changer", "I'd be happy to assist you", "elevate your wardrobe"],
  formality: "casual",
};

const POLICIES: Policies = {
  returns: "Free returns within 30 days of delivery on unworn items with tags attached.",
  shipping: "Free standard shipping over $75; orders ship in 1–2 business days.",
  exchange:
    "Free size and color exchanges within 30 days — we send the new item before you return the old one.",
  other: "Gift orders include a prepaid return label and no pricing on the packing slip.",
};

type SeededVariant = { id: string; priceCents: number; title: string | null };

async function upsertBrand(): Promise<string> {
  const brand = one(
    await db
      .insert(brands)
      .values({
        name: "Demo Apparel Co",
        slug: BRAND_SLUG,
        voiceConfig: VOICE,
        policies: POLICIES,
        quietHours: { start: "09:00", end: "21:00" },
        frequencyCaps: { perDay: 1, perWeek: 3 },
        supervisedMode: true,
        channelConfig: CHANNEL_CONFIG,
      })
      .onConflictDoUpdate({
        target: brands.slug,
        set: { voiceConfig: VOICE, policies: POLICIES, channelConfig: CHANNEL_CONFIG },
      })
      .returning(),
  );
  return brand.id;
}

async function upsertOwner(brandId: string): Promise<void> {
  const passwordHash = bcrypt.hashSync(OWNER_PASSWORD, 10);
  await db
    .insert(users)
    .values({ brandId, email: OWNER_EMAIL, name: "Demo Owner", role: "owner", passwordHash })
    .onConflictDoUpdate({ target: users.email, set: { passwordHash, brandId } });
}

type ProductSpec = {
  title: string;
  description: string;
  fitNotes: string;
  priceCents: number;
  colors: string[];
  sizes: string[];
};

const CATALOG: ProductSpec[] = [
  {
    title: "The Everyday Tee",
    description: "A heavyweight 100% organic cotton tee with a clean crew neck.",
    fitNotes: "Runs true to size; size up for a relaxed, drapey fit.",
    priceCents: 2800,
    colors: ["Black", "White", "Olive"],
    sizes: ["S", "M", "L", "XL"],
  },
  {
    title: "Merino Crew Sweater",
    description: "Midweight extra-fine merino, fully fashioned for a clean shoulder.",
    fitNotes: "Runs roomy through the chest; if you're between sizes, size down.",
    priceCents: 8900,
    colors: ["Charcoal", "Oatmeal"],
    sizes: ["S", "M", "L", "XL"],
  },
  {
    title: "Selvedge Denim Jacket",
    description: "14oz Japanese selvedge denim trucker that breaks in beautifully.",
    fitNotes: "Boxy through the shoulders; size down for a cropped, trim look.",
    priceCents: 14800,
    colors: ["Indigo"],
    sizes: ["S", "M", "L", "XL"],
  },
  {
    title: "Linen Camp Shirt",
    description: "Breathable European linen with a relaxed camp collar.",
    fitNotes: "Cut relaxed; size down for a trimmer fit.",
    priceCents: 6400,
    colors: ["Sand", "Sage"],
    sizes: ["S", "M", "L", "XL"],
  },
  {
    title: "Performance Chino",
    description: "Four-way stretch chino with a hidden comfort waistband.",
    fitNotes: "Athletic taper; true to your usual waist size.",
    priceCents: 7800,
    colors: ["Stone", "Navy"],
    sizes: ["S", "M", "L", "XL"],
  },
  {
    title: "Waffle Henley",
    description: "Slubby cotton waffle knit with a three-button placket.",
    fitNotes: "True to size; layers well under the denim jacket.",
    priceCents: 4200,
    colors: ["Rust", "Black"],
    sizes: ["S", "M", "L", "XL"],
  },
  {
    title: "Cashmere Beanie",
    description: "Two-ply Mongolian cashmere in a classic ribbed cuff.",
    fitNotes: "One size; gentle stretch fits most.",
    priceCents: 3800,
    colors: ["Oatmeal", "Charcoal"],
    sizes: ["One Size"],
  },
  {
    title: "Recycled Puffer Vest",
    description: "Lightweight recycled-nylon shell with PrimaLoft fill.",
    fitNotes: "Size up if you plan to layer it over chunky knits.",
    priceCents: 11800,
    colors: ["Black", "Forest"],
    sizes: ["S", "M", "L", "XL"],
  },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function seedCatalog(brandId: string): Promise<void> {
  for (const spec of CATALOG) {
    const slug = slugify(spec.title);
    const variants = spec.colors.flatMap((color) =>
      spec.sizes.map((size) => ({
        shopifyVariantId: `demo-${slug}-${slugify(color)}-${slugify(size)}`,
        title: `${color} / ${size}`,
        sku: `${slug}-${slugify(color)}-${slugify(size)}`.toUpperCase(),
        priceCents: spec.priceCents,
        // One sold-out variant to exercise stock handling: Everyday Tee, Olive / M.
        inventoryQty:
          spec.title === "The Everyday Tee" && color === "Olive" && size === "M" ? 0 : 25,
        options: { color, size },
      })),
    );
    await repos.products.createWithVariants(
      brandId,
      {
        shopifyProductId: `demo-${slug}`,
        title: spec.title,
        description: spec.description,
        fitNotes: spec.fitNotes,
        status: "active",
      },
      variants,
    );
  }
}

type CustomerSpec = {
  phoneE164: string;
  name: string;
  email: string;
  timezone: string;
  experimentGroup: "treatment" | "control" | null;
};

const CUSTOMERS: CustomerSpec[] = [
  {
    phoneE164: "+15550100001",
    name: "Maya Chen",
    email: "maya@example.test",
    timezone: "America/Los_Angeles",
    experimentGroup: "treatment",
  },
  {
    phoneE164: "+15550100002",
    name: "Theo Alvarez",
    email: "theo@example.test",
    timezone: "America/New_York",
    experimentGroup: "control",
  },
  {
    phoneE164: "+15550100003",
    name: "Priya Nair",
    email: "priya@example.test",
    timezone: "America/Chicago",
    experimentGroup: "treatment",
  },
  {
    phoneE164: "+15550100004",
    name: "Sam Whitfield",
    email: "sam@example.test",
    timezone: "America/Denver",
    experimentGroup: null,
  },
  {
    phoneE164: "+15550100005",
    name: "Lena Kowalski",
    email: "lena@example.test",
    timezone: "America/New_York",
    experimentGroup: "treatment",
  },
];

async function seedCustomers(brandId: string): Promise<string[]> {
  const ids: string[] = [];
  for (const c of CUSTOMERS) {
    const customer = await repos.customers.upsertByPhone(brandId, c.phoneE164, {
      name: c.name,
      email: c.email,
      timezone: c.timezone,
      experimentGroup: c.experimentGroup,
      consentStatus: "opted_in",
      consentSource: "checkout_optin",
      consentAt: new Date(),
    });
    ids.push(customer.id);
  }
  return ids;
}

const DAY = 24 * 60 * 60 * 1000;

async function seedOrders(
  brandId: string,
  customerIds: string[],
  variants: SeededVariant[],
): Promise<void> {
  const now = Date.now();
  const v = (i: number): SeededVariant => {
    const variant = variants[i % variants.length];
    if (!variant) throw new Error(`no seeded variant at index ${i}`);
    return variant;
  };
  const cust = (i: number): string => {
    const id = customerIds[i % customerIds.length];
    if (!id) throw new Error(`no seeded customer at index ${i}`);
    return id;
  };

  type OrderSpec = {
    customerIdx: number;
    fulfillmentStatus: "unfulfilled" | "fulfilled" | "partial";
    daysAgoCreated: number;
    shippedDaysAgo?: number;
    deliveredDaysAgo?: number;
    variantIdxs: number[];
  };

  const SPECS: OrderSpec[] = [
    {
      customerIdx: 0,
      fulfillmentStatus: "fulfilled",
      daysAgoCreated: 14,
      shippedDaysAgo: 12,
      deliveredDaysAgo: 10,
      variantIdxs: [0, 5],
    },
    {
      customerIdx: 1,
      fulfillmentStatus: "fulfilled",
      daysAgoCreated: 4,
      shippedDaysAgo: 2,
      variantIdxs: [8],
    },
    {
      customerIdx: 2,
      fulfillmentStatus: "fulfilled",
      daysAgoCreated: 6,
      shippedDaysAgo: 5,
      deliveredDaysAgo: 3,
      variantIdxs: [12],
    },
    { customerIdx: 3, fulfillmentStatus: "unfulfilled", daysAgoCreated: 1, variantIdxs: [3, 16] },
    {
      customerIdx: 4,
      fulfillmentStatus: "partial",
      daysAgoCreated: 8,
      shippedDaysAgo: 6,
      variantIdxs: [20],
    },
    {
      customerIdx: 0,
      fulfillmentStatus: "fulfilled",
      daysAgoCreated: 40,
      shippedDaysAgo: 38,
      deliveredDaysAgo: 36,
      variantIdxs: [24],
    },
  ];

  let n = 1;
  for (const spec of SPECS) {
    const lineItems = spec.variantIdxs.map((idx) => {
      const variant = v(idx);
      return {
        variantId: variant.id,
        title: variant.title,
        qty: 1,
        priceCents: variant.priceCents,
      };
    });
    const totalCents = lineItems.reduce((sum, li) => sum + (li.priceCents ?? 0) * li.qty, 0);
    await repos.orders.createWithLineItems(
      brandId,
      {
        customerId: cust(spec.customerIdx),
        shopifyOrderId: `demo-order-${n}`,
        status: "open",
        totalCents,
        fulfillmentStatus: spec.fulfillmentStatus,
        trackingNumber: spec.shippedDaysAgo !== undefined ? `1Z999AA10${100000 + n}` : null,
        carrier: spec.shippedDaysAgo !== undefined ? "UPS" : null,
        shippedAt:
          spec.shippedDaysAgo !== undefined ? new Date(now - spec.shippedDaysAgo * DAY) : null,
        deliveredAt:
          spec.deliveredDaysAgo !== undefined ? new Date(now - spec.deliveredDaysAgo * DAY) : null,
        createdAt: new Date(now - spec.daysAgoCreated * DAY),
      },
      lineItems,
    );
    n += 1;
  }
}

const PLAYBOOKS: Array<{
  key: string;
  triggerType: string;
  promptTemplate: string;
  delayMinutes: number;
}> = [
  {
    key: "delivery_checkin",
    triggerType: "order_delivered",
    delayMinutes: 1440,
    promptTemplate:
      "Your order arrived a day ago — check in warmly as {agentName} and ask how the fit is. If anything's off, offer a free size/color exchange. Keep it short and human.",
  },
  {
    key: "exchange_rescue",
    triggerType: "return_intent",
    delayMinutes: 0,
    promptTemplate:
      "The customer is considering a return. As {agentName}, find what's wrong (size, fit, color) and recommend an in-stock alternative, offering a free exchange before they hit the return portal.",
  },
];

async function upsertPlaybooks(brandId: string): Promise<void> {
  for (const pb of PLAYBOOKS) {
    const existing = (
      await db
        .select()
        .from(playbooks)
        .where(and(eq(playbooks.brandId, brandId), eq(playbooks.key, pb.key)))
        .limit(1)
    )[0];
    if (existing) {
      await db
        .update(playbooks)
        .set({ enabled: true, promptTemplate: pb.promptTemplate, delayMinutes: pb.delayMinutes })
        .where(eq(playbooks.id, existing.id));
    } else {
      await db.insert(playbooks).values({
        brandId,
        key: pb.key,
        triggerType: pb.triggerType,
        enabled: true,
        promptTemplate: pb.promptTemplate,
        delayMinutes: pb.delayMinutes,
      });
    }
  }
}

async function main() {
  const brandId = await upsertBrand();
  await upsertOwner(brandId);

  const existingProducts = await repos.products.list(brandId);
  if (existingProducts.length === 0) {
    await seedCatalog(brandId);
    const customerIds = await seedCustomers(brandId);
    const variants = await db
      .select({
        id: productVariants.id,
        priceCents: productVariants.priceCents,
        title: productVariants.title,
      })
      .from(productVariants)
      .where(eq(productVariants.brandId, brandId));
    const normalized: SeededVariant[] = variants.map((v) => ({
      id: v.id,
      priceCents: v.priceCents ?? 0,
      title: v.title,
    }));
    await seedOrders(brandId, customerIds, normalized);
    console.log(`  seeded ${CATALOG.length} products, ${CUSTOMERS.length} customers, 6 orders`);
  } else {
    console.log("  catalog/customers/orders already present — skipping bulk seed");
  }
  await upsertPlaybooks(brandId);

  console.log("\n✅ Seed complete — Demo Apparel Co");
  console.log("─".repeat(48));
  console.log("  Dashboard login (dev only):");
  console.log(`    email:    ${OWNER_EMAIL}`);
  console.log(`    password: ${OWNER_PASSWORD}`);
  console.log("─".repeat(48));
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await pool.end();
    process.exit(1);
  });
