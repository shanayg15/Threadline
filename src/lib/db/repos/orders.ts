import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { orderLineItems, orders } from "@/lib/db/schema";
import { one } from "./_util";

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type NewOrderLineItem = typeof orderLineItems.$inferInsert;

export async function list(brandId: string): Promise<Order[]> {
  return db
    .select()
    .from(orders)
    .where(eq(orders.brandId, brandId))
    .orderBy(desc(orders.createdAt));
}

export async function listForCustomer(brandId: string, customerId: string): Promise<Order[]> {
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.brandId, brandId), eq(orders.customerId, customerId)))
    .orderBy(desc(orders.createdAt));
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
