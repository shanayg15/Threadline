import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { pendingActions, type pendingActionType } from "@/lib/db/schema";
import { one } from "./_util";

export type PendingAction = typeof pendingActions.$inferSelect;

type ActionType = (typeof pendingActionType.enumValues)[number];

/** The single open (pending) action for a conversation, if any. */
export async function getOpen(
  brandId: string,
  conversationId: string,
): Promise<PendingAction | undefined> {
  const rows = await db
    .select()
    .from(pendingActions)
    .where(
      and(
        eq(pendingActions.brandId, brandId),
        eq(pendingActions.conversationId, conversationId),
        eq(pendingActions.status, "pending"),
      ),
    )
    .limit(1);
  return rows[0];
}

/**
 * Create a pending action. At most one may be open per conversation — enforced
 * here and, defensively, by a partial unique index in the schema.
 */
export async function create(
  brandId: string,
  data: {
    conversationId: string;
    type: ActionType;
    payload?: Record<string, unknown>;
    expiresAt?: Date;
  },
): Promise<PendingAction> {
  const open = await getOpen(brandId, data.conversationId);
  if (open) {
    throw new Error(
      `Conversation ${data.conversationId} already has an open pending action (${open.id})`,
    );
  }
  try {
    return one(
      await db
        .insert(pendingActions)
        .values({
          brandId,
          conversationId: data.conversationId,
          type: data.type,
          payload: data.payload,
          expiresAt: data.expiresAt,
        })
        .returning(),
    );
  } catch (err) {
    // Concurrent caller won the race: the partial unique index is the real guard,
    // so surface the same friendly error instead of a raw 23505.
    if (err && typeof err === "object" && "code" in err && err.code === "23505") {
      throw new Error(`Conversation ${data.conversationId} already has an open pending action`);
    }
    throw err;
  }
}

export async function confirm(brandId: string, id: string): Promise<PendingAction | undefined> {
  const rows = await db
    .update(pendingActions)
    .set({ status: "confirmed", confirmedAt: new Date() })
    .where(
      and(
        eq(pendingActions.brandId, brandId),
        eq(pendingActions.id, id),
        eq(pendingActions.status, "pending"),
      ),
    )
    .returning();
  return rows[0];
}

export async function cancel(brandId: string, id: string): Promise<PendingAction | undefined> {
  const rows = await db
    .update(pendingActions)
    .set({ status: "cancelled" })
    .where(and(eq(pendingActions.brandId, brandId), eq(pendingActions.id, id)))
    .returning();
  return rows[0];
}

export async function expire(brandId: string, id: string): Promise<PendingAction | undefined> {
  const rows = await db
    .update(pendingActions)
    .set({ status: "expired" })
    .where(
      and(
        eq(pendingActions.brandId, brandId),
        eq(pendingActions.id, id),
        eq(pendingActions.status, "pending"),
      ),
    )
    .returning();
  return rows[0];
}
