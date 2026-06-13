import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { events, type eventType } from "@/lib/db/schema";
import { one } from "./_util";

export type Event = typeof events.$inferSelect;

type EventType = (typeof eventType.enumValues)[number];

type NewEvent = {
  type: EventType;
  customerId?: string | null;
  payload?: Record<string, unknown>;
  dedupeKey?: string;
};

/** Record a lifecycle event. The M8 scheduler consumes these; M4 only writes them. */
export async function record(brandId: string, entry: NewEvent): Promise<Event> {
  return one(
    await db
      .insert(events)
      .values({ ...entry, brandId })
      .returning(),
  );
}

/**
 * Record an event at most once per (brandId, dedupeKey). Returns the new row, or
 * null if an event with that dedupe key already exists — so webhook retries and
 * double-topic deliveries (orders/fulfilled + fulfillments/update) emit one event.
 */
export async function recordIfNew(
  brandId: string,
  entry: NewEvent & { dedupeKey: string },
): Promise<Event | null> {
  const rows = await db
    .insert(events)
    .values({ ...entry, brandId })
    .onConflictDoNothing()
    .returning();
  return rows[0] ?? null;
}

/** Unprocessed events for a brand, oldest first (M8 lifecycle engine). */
export async function listUnprocessed(brandId: string, limit = 100): Promise<Event[]> {
  return db
    .select()
    .from(events)
    .where(and(eq(events.brandId, brandId), isNull(events.processedAt)))
    .orderBy(asc(events.createdAt))
    .limit(limit);
}
