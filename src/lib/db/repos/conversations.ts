import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  conversations,
  messages,
  type assigneeType,
  type conversationChannel,
  type conversationStatus,
} from "@/lib/db/schema";
import { one } from "./_util";

export type Conversation = typeof conversations.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Message = typeof messages.$inferSelect;

type Channel = (typeof conversationChannel.enumValues)[number];
type Status = (typeof conversationStatus.enumValues)[number];
type AssigneeType = (typeof assigneeType.enumValues)[number];

/** Get the customer's existing thread for this brand, or create one. */
export async function getOrCreateForCustomer(
  brandId: string,
  customerId: string,
  channel: Channel = "sms",
): Promise<Conversation> {
  const existing = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.brandId, brandId), eq(conversations.customerId, customerId)))
    .orderBy(desc(conversations.createdAt))
    .limit(1);
  if (existing[0]) return existing[0];

  return one(await db.insert(conversations).values({ brandId, customerId, channel }).returning());
}

/** Append a message and bump the conversation's lastMessageAt, atomically. */
export async function appendMessage(
  brandId: string,
  message: Omit<NewMessage, "brandId">,
): Promise<Message> {
  return db.transaction(async (tx) => {
    const inserted = one(
      await tx
        .insert(messages)
        .values({ ...message, brandId })
        .returning(),
    );
    await tx
      .update(conversations)
      .set({ lastMessageAt: inserted.createdAt })
      .where(and(eq(conversations.brandId, brandId), eq(conversations.id, message.conversationId)));
    return inserted;
  });
}

export async function listFiltered(
  brandId: string,
  filters: { status?: Status } = {},
): Promise<Conversation[]> {
  const where = filters.status
    ? and(eq(conversations.brandId, brandId), eq(conversations.status, filters.status))
    : eq(conversations.brandId, brandId);
  return db.select().from(conversations).where(where).orderBy(desc(conversations.lastMessageAt));
}

/** Load a conversation with its messages (chronological) and customer. */
export async function getWithMessages(brandId: string, id: string) {
  return db.query.conversations.findFirst({
    where: and(eq(conversations.brandId, brandId), eq(conversations.id, id)),
    with: {
      customer: true,
      messages: { orderBy: asc(messages.createdAt) },
    },
  });
}

export async function setStatus(
  brandId: string,
  id: string,
  status: Status,
): Promise<Conversation | undefined> {
  const rows = await db
    .update(conversations)
    .set({ status })
    .where(and(eq(conversations.brandId, brandId), eq(conversations.id, id)))
    .returning();
  return rows[0];
}

export async function setAssignee(
  brandId: string,
  id: string,
  assignee: { type: AssigneeType; userId?: string | null },
): Promise<Conversation | undefined> {
  const rows = await db
    .update(conversations)
    .set({ assigneeType: assignee.type, assigneeUserId: assignee.userId ?? null })
    .where(and(eq(conversations.brandId, brandId), eq(conversations.id, id)))
    .returning();
  return rows[0];
}

export async function setPaused(
  brandId: string,
  id: string,
  paused: boolean,
): Promise<Conversation | undefined> {
  const rows = await db
    .update(conversations)
    .set({ paused })
    .where(and(eq(conversations.brandId, brandId), eq(conversations.id, id)))
    .returning();
  return rows[0];
}
