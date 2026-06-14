import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { messages, type deliveryStatus } from "@/lib/db/schema";

export type Message = typeof messages.$inferSelect;

type DeliveryStatus = (typeof deliveryStatus.enumValues)[number];

/** True if a message with this provider/channel id was already recorded for the brand.
 * Used by the inbound webhook to dedupe Twilio retries (idempotent processing). */
export async function existsByChannelId(
  brandId: string,
  channelMessageId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.brandId, brandId), eq(messages.channelMessageId, channelMessageId)))
    .limit(1);
  return rows.length > 0;
}

/** Resolve the owning brand of a globally-unique provider message id. The Twilio
 * status callback carries no tenant context (and its `From` may be a rotated
 * Messaging Service number), so we resolve the tenant by the SID we issued. */
export async function findBrandIdByChannelId(
  channelMessageId: string,
): Promise<string | undefined> {
  const rows = await db
    .select({ brandId: messages.brandId })
    .from(messages)
    .where(eq(messages.channelMessageId, channelMessageId))
    .limit(1);
  return rows[0]?.brandId;
}

export async function listForConversation(
  brandId: string,
  conversationId: string,
): Promise<Message[]> {
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.brandId, brandId), eq(messages.conversationId, conversationId)))
    .orderBy(asc(messages.createdAt));
}

/** Update delivery status by the channel/provider message id (e.g. Twilio status webhook). */
export async function setDeliveryStatusByChannelId(
  brandId: string,
  channelMessageId: string,
  status: DeliveryStatus,
): Promise<Message | undefined> {
  const rows = await db
    .update(messages)
    .set({ deliveryStatus: status })
    .where(and(eq(messages.brandId, brandId), eq(messages.channelMessageId, channelMessageId)))
    .returning();
  return rows[0];
}
