import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { customers, orderLineItems, orders } from "@/lib/db/schema";
import { one } from "./_util";

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type NewOrderLineItem = typeof orderLineItems.$inferInsert;
export type OrderWithCustomer = Order & { customerName: string | null; phoneE164: string };

export async function list(brandId: string): Promise<Order[]> {
  return db
    .select()
    .from(orders)
    .where(eq(orders.brandId, brandId))
    .orderBy(desc(orders.createdAt));
}

/** Orders joined to their customer (for the Orders read page). */
export async function listWithCustomer(brandId: string): Promise<OrderWithCustomer[]> {
  const rows = await db
    .select({ order: orders, customer: customers })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .where(eq(orders.brandId, brandId))
    .orderBy(desc(orders.createdAt));
  return rows.map((r) => ({
    ...r.order,
    customerName: r.customer.name,
    phoneE164: r.customer.phoneE164,
  }));
}

export async function listForCustomer(brandId: string, customerId: string): Promise<Order[]> {
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.brandId, brandId), eq(orders.customerId, customerId)))
    .orderBy(desc(orders.createdAt));
}

export async function getByShopifyOrderId(
  brandId: string,
  shopifyOrderId: string,
): Promise<Order | undefined> {
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.brandId, brandId), eq(orders.shopifyOrderId, shopifyOrderId)))
    .limit(1);
  return rows[0];
}

/** Orders the heuristic delivery sweep should evaluate: shipped/fulfilled but not yet
 * marked delivered. */
export async function listDeliverable(brandId: string): Promise<Order[]> {
  return db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.brandId, brandId),
        isNull(orders.deliveredAt),
        sql`${orders.shippedAt} is not null`,
        sql`${orders.fulfillmentStatus} in ('fulfilled','partial')`,
      ),
    );
}

export async function setDeliveredAt(
  brandId: string,
  id: string,
  deliveredAt: Date,
): Promise<Order | undefined> {
  const rows = await db
    .update(orders)
    .set({ deliveredAt })
    .where(and(eq(orders.brandId, brandId), eq(orders.id, id), isNull(orders.deliveredAt)))
    .returning();
  return rows[0];
}

/** Attribute an order to the conversation that drove it (M8). Idempotent: only sets it
 * when not already attributed, so a webhook retry doesn't re-attribute. */
export async function setAttributedConversation(
  brandId: string,
  orderId: string,
  conversationId: string,
): Promise<Order | undefined> {
  const rows = await db
    .update(orders)
    .set({ attributedConversationId: conversationId })
    .where(
      and(
        eq(orders.brandId, brandId),
        eq(orders.id, orderId),
        isNull(orders.attributedConversationId),
      ),
    )
    .returning();
  return rows[0];
}

/** Load an order with its line items. */
export async function getWithLineItems(brandId: string, id: string) {
  return db.query.orders.findFirst({
    where: and(eq(orders.brandId, brandId), eq(orders.id, id)),
    with: { lineItems: true },
  });
}

/** Create an order together with its line items (brandId stamped on both). */
export async function createWithLineItems(
  brandId: string,
  order: Omit<NewOrder, "brandId" | "id">,
  lineItems: Array<Omit<NewOrderLineItem, "brandId" | "orderId" | "id">>,
): Promise<Order> {
  return db.transaction(async (tx) => {
    const created = one(
      await tx
        .insert(orders)
        .values({ ...order, brandId })
        .returning(),
    );
    if (lineItems.length > 0) {
      await tx
        .insert(orderLineItems)
        .values(lineItems.map((li) => ({ ...li, brandId, orderId: created.id })));
    }
    return created;
  });
}
