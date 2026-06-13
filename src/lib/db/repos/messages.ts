import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { messages, type deliveryStatus } from "@/lib/db/schema";

export type Message = typeof messages.$inferSelect;

type DeliveryStatus = (typeof deliveryStatus.enumValues)[number];

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
