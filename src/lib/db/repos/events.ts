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

/** Unprocessed events across ALL brands (the worker's lifecycle sweep). */
export async function listUnprocessedAll(limit = 200): Promise<Event[]> {
  return db
    .select()
    .from(events)
    .where(isNull(events.processedAt))
    .orderBy(asc(events.createdAt))
    .limit(limit);
}

/**
 * Atomically CLAIM an event: stamp processedAt only if still unprocessed. Returns the
 * row when this caller won the claim, or undefined if it was already processed — so the
 * scheduler (even on a BullMQ retry or a second worker) handles each event at most once.
 */
export async function markProcessed(brandId: string, id: string): Promise<Event | undefined> {
  const rows = await db
    .update(events)
    .set({ processedAt: new Date() })
    .where(and(eq(events.brandId, brandId), eq(events.id, id), isNull(events.processedAt)))
    .returning();
  return rows[0];
}
