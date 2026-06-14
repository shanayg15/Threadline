import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  conversations,
  customers,
  orders,
  type consentStatus,
  type experimentGroup,
} from "@/lib/db/schema";
import { one } from "./_util";

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type CustomerWithStats = {
  customer: Customer;
  orderCount: number;
  lastContactAt: Date | null;
  conversationId: string | null;
};

type ConsentStatus = (typeof consentStatus.enumValues)[number];
type ExperimentGroup = (typeof experimentGroup.enumValues)[number];

/** Mutable customer fields (brandId + phoneE164 are the identity, set separately). */
type CustomerData = Partial<Omit<NewCustomer, "id" | "brandId" | "phoneE164" | "createdAt">>;

export async function getByPhone(
  brandId: string,
  phoneE164: string,
): Promise<Customer | undefined> {
  const rows = await db
    .select()
    .from(customers)
    .where(and(eq(customers.brandId, brandId), eq(customers.phoneE164, phoneE164)))
    .limit(1);
  return rows[0];
}

export async function getById(brandId: string, id: string): Promise<Customer | undefined> {
  const rows = await db
    .select()
    .from(customers)
    .where(and(eq(customers.brandId, brandId), eq(customers.id, id)))
    .limit(1);
  return rows[0];
}

export async function list(brandId: string): Promise<Customer[]> {
  return db.select().from(customers).where(eq(customers.brandId, brandId));
}

/** Customers + order count, last contact time, and a conversation to link to (Customers
 * read page). A few aggregate queries assembled in JS — no N+1. */
export async function listWithStats(brandId: string): Promise<CustomerWithStats[]> {
  const [custs, orderCounts, convs] = await Promise.all([
    list(brandId),
    db
      .select({ customerId: orders.customerId, count: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.brandId, brandId))
      .groupBy(orders.customerId),
    db
      .select({
        id: conversations.id,
        customerId: conversations.customerId,
        lastMessageAt: conversations.lastMessageAt,
      })
      .from(conversations)
      .where(eq(conversations.brandId, brandId))
      .orderBy(desc(conversations.lastMessageAt)),
  ]);

  const countByCustomer = new Map(orderCounts.map((r) => [r.customerId, r.count]));
  const latestConvo = new Map<string, { id: string; lastMessageAt: Date | null }>();
  for (const c of convs) if (!latestConvo.has(c.customerId)) latestConvo.set(c.customerId, c);

  return custs.map((customer) => {
    const convo = latestConvo.get(customer.id);
    return {
      customer,
      orderCount: countByCustomer.get(customer.id) ?? 0,
      lastContactAt: convo?.lastMessageAt ?? null,
      conversationId: convo?.id ?? null,
    };
  });
}

/** Insert or update a customer keyed by (brandId, phoneE164). */
export async function upsertByPhone(
  brandId: string,
  phoneE164: string,
  data: CustomerData = {},
): Promise<Customer> {
  const insert = db.insert(customers).values({ ...data, brandId, phoneE164 });

  // Drizzle rejects an empty onConflict set, so with no fields to update (e.g. just
  // registering an inbound sender) fall back to DO NOTHING + read the existing row.
  if (Object.keys(data).length === 0) {
    const inserted = await insert.onConflictDoNothing().returning();
    if (inserted[0]) return inserted[0];
    const existing = await getByPhone(brandId, phoneE164);
    if (!existing) throw new Error("upsertByPhone: row vanished after conflict");
    return existing;
  }

  return one(
    await insert
      .onConflictDoUpdate({ target: [customers.brandId, customers.phoneE164], set: data })
      .returning(),
  );
}

export async function setConsent(
  brandId: string,
  customerId: string,
  consent: {
    status: ConsentStatus;
    source?: string;
    at?: Date;
    optedOutAt?: Date | null;
  },
): Promise<Customer | undefined> {
  const rows = await db
    .update(customers)
    .set({
      consentStatus: consent.status,
      consentSource: consent.source,
      consentAt: consent.at,
      optedOutAt: consent.optedOutAt,
    })
    .where(and(eq(customers.brandId, brandId), eq(customers.id, customerId)))
    .returning();
  return rows[0];
}

export async function assignExperimentGroup(
  brandId: string,
  customerId: string,
  group: ExperimentGroup,
): Promise<Customer | undefined> {
  const rows = await db
    .update(customers)
    .set({ experimentGroup: group })
    .where(and(eq(customers.brandId, brandId), eq(customers.id, customerId)))
    .returning();
  return rows[0];
}
