import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { events, type eventType } from "@/lib/db/schema";
import { one } from "./_util";

export type Event = typeof events.$inferSelect;

type EventType = (typeof eventType.enumValues)[number];

/** Record a lifecycle event. The M8 scheduler consumes these; M4 only writes them. */
export async function record(
  brandId: string,
  entry: {
    type: EventType;
    customerId?: string | null;
    payload?: Record<string, unknown>;
  },
): Promise<Event> {
  return one(
    await db
      .insert(events)
      .values({ ...entry, brandId })
      .returning(),
  );
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
