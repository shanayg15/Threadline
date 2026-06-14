import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  conversations,
  customers,
  messages,
  type assigneeType,
  type conversationChannel,
  type conversationStatus,
  type deliveryStatus,
} from "@/lib/db/schema";
import { isUniqueViolation, one } from "./_util";

export type Conversation = typeof conversations.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Message = typeof messages.$inferSelect;

type Channel = (typeof conversationChannel.enumValues)[number];
type Status = (typeof conversationStatus.enumValues)[number];
type AssigneeType = (typeof assigneeType.enumValues)[number];
type DeliveryStatus = (typeof deliveryStatus.enumValues)[number];

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

// ---- Supervised-mode drafts (M7) ----
//
// A held draft is an outbound message row with approvalStatus 'pending' that is NOT
// sent and does NOT bump lastMessageAt. On approval it is delivered in place (becomes
// 'approved' + gets a channelMessageId/deliveryStatus); on reject it becomes 'rejected'.
// Thread rendering shows messages with approvalStatus null or 'approved'; the open
// 'pending' draft is surfaced separately in the Approve/Edit/Reject bar.

/** The single open (pending-approval) draft for a conversation, if any. */
export async function getOpenDraft(
  brandId: string,
  conversationId: string,
): Promise<Message | undefined> {
  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.brandId, brandId),
        eq(messages.conversationId, conversationId),
        eq(messages.approvalStatus, "pending"),
      ),
    )
    .limit(1);
  return rows[0];
}

/** Hold an agent reply as a draft (supervised mode). At most one open draft per
 * conversation; if one already exists, return it rather than racing the unique index. */
export async function createDraft(
  brandId: string,
  data: { conversationId: string; body: string; model?: string | null; costCents?: number | null },
): Promise<Message> {
  const open = await getOpenDraft(brandId, data.conversationId);
  if (open) return open;
  try {
    return one(
      await db
        .insert(messages)
        .values({
          brandId,
          conversationId: data.conversationId,
          direction: "outbound",
          sender: "ai",
          body: data.body,
          approvalStatus: "pending",
          model: data.model ?? null,
          costCents: data.costCents ?? null,
        })
        .returning(),
    );
  } catch (err) {
    if (isUniqueViolation(err)) {
      const existing = await getOpenDraft(brandId, data.conversationId);
      if (existing) return existing;
    }
    throw err;
  }
}

export async function getDraftById(brandId: string, id: string): Promise<Message | undefined> {
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.brandId, brandId), eq(messages.id, id)))
    .limit(1);
  return rows[0];
}

/** Edit a still-pending draft's body before approval. */
export async function updateDraftBody(
  brandId: string,
  id: string,
  body: string,
): Promise<Message | undefined> {
  const rows = await db
    .update(messages)
    .set({ body })
    .where(
      and(
        eq(messages.brandId, brandId),
        eq(messages.id, id),
        eq(messages.approvalStatus, "pending"),
      ),
    )
    .returning();
  return rows[0];
}

/** Turn an approved draft INTO a sent message (called after the channel send succeeds):
 * flips it to 'approved', stamps the provider id/status/sender, and bumps lastMessageAt. */
export async function markDraftSent(
  brandId: string,
  id: string,
  data: {
    sender: "ai" | "human";
    approvedByUserId: string;
    body?: string;
    channelMessageId: string;
    deliveryStatus: DeliveryStatus;
  },
): Promise<Message | undefined> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(messages)
      .set({
        approvalStatus: "approved",
        approvedByUserId: data.approvedByUserId,
        sender: data.sender,
        ...(data.body !== undefined ? { body: data.body } : {}),
        channelMessageId: data.channelMessageId,
        deliveryStatus: data.deliveryStatus,
      })
      .where(
        and(
          eq(messages.brandId, brandId),
          eq(messages.id, id),
          eq(messages.approvalStatus, "pending"),
        ),
      )
      .returning();
    const updated = rows[0];
    if (updated) {
      await tx
        .update(conversations)
        .set({ lastMessageAt: new Date() })
        .where(and(eq(conversations.brandId, brandId), eq(conversations.id, updated.conversationId)));
    }
    return updated;
  });
}

export async function rejectDraft(
  brandId: string,
  id: string,
  approvedByUserId: string,
): Promise<Message | undefined> {
  const rows = await db
    .update(messages)
    .set({ approvalStatus: "rejected", approvedByUserId })
    .where(
      and(
        eq(messages.brandId, brandId),
        eq(messages.id, id),
        eq(messages.approvalStatus, "pending"),
      ),
    )
    .returning();
  return rows[0];
}

export type DraftQueueItem = {
  draft: Message;
  conversationId: string;
  customerId: string;
  customerName: string | null;
  phoneE164: string;
};

/** All pending drafts across the brand (the supervised review queue). */
export async function listOpenDrafts(brandId: string): Promise<DraftQueueItem[]> {
  const rows = await db
    .select({ draft: messages, customer: customers })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .innerJoin(customers, eq(customers.id, conversations.customerId))
    .where(and(eq(messages.brandId, brandId), eq(messages.approvalStatus, "pending")))
    .orderBy(asc(messages.createdAt));
  return rows.map((r) => ({
    draft: r.draft,
    conversationId: r.draft.conversationId,
    customerId: r.customer.id,
    customerName: r.customer.name,
    phoneE164: r.customer.phoneE164,
  }));
}

// ---- Inbox list (M7 console) ----

export type InboxFilters = {
  status?: Status;
  /** all (default) · has_reply (latest msg is inbound) · scheduled (an open draft exists). */
  activity?: "all" | "has_reply" | "scheduled";
};

export type InboxRow = {
  id: string;
  status: Status;
  assigneeType: AssigneeType;
  paused: boolean;
  lastMessageAt: Date | null;
  customerId: string;
  customerName: string | null;
  phoneE164: string;
  lastMessageBody: string | null;
  lastMessageDirection: "inbound" | "outbound" | null;
  lastMessageAtPreview: Date | null;
  unreadCount: number;
  hasOpenDraft: boolean;
  hasPendingAction: boolean;
};

/**
 * The conversation inbox: each conversation with its customer, last (non-draft) message
 * preview, count of inbound messages awaiting a response, and whether a draft / pending
 * action is open. One query (lateral joins), brand-scoped, newest activity first.
 */
export async function listForInbox(
  brandId: string,
  filters: InboxFilters = {},
): Promise<InboxRow[]> {
  const statusClause = filters.status ? sql`and c.status = ${filters.status}` : sql``;
  const result = await db.execute(sql`
    select
      c.id, c.status, c.assignee_type, c.paused, c.last_message_at,
      cu.id as customer_id, cu.name as customer_name, cu.phone_e164,
      lm.body as last_body, lm.direction as last_direction, lm.created_at as last_created,
      coalesce(ur.unread, 0) as unread,
      (od.id is not null) as has_open_draft,
      (pa.id is not null) as has_pending_action
    from conversations c
    join customers cu on cu.id = c.customer_id
    left join lateral (
      select m.body, m.direction, m.created_at
      from messages m
      where m.conversation_id = c.id and m.approval_status is null
      order by m.created_at desc limit 1
    ) lm on true
    left join lateral (
      select count(*)::int as unread
      from messages m
      where m.conversation_id = c.id and m.direction = 'inbound'
        and m.created_at > coalesce(
          (select max(mo.created_at) from messages mo
           where mo.conversation_id = c.id and mo.direction = 'outbound' and mo.approval_status is null),
          to_timestamp(0)
        )
    ) ur on true
    left join lateral (
      select id from messages m
      where m.conversation_id = c.id and m.approval_status = 'pending' limit 1
    ) od on true
    left join lateral (
      select id from pending_actions p
      where p.conversation_id = c.id and p.status = 'pending' limit 1
    ) pa on true
    where c.brand_id = ${brandId} ${statusClause}
    order by c.last_message_at desc nulls last, c.created_at desc
  `);

  const rows = (result as unknown as { rows: Record<string, unknown>[] }).rows;
  const mapped: InboxRow[] = rows.map((r) => ({
    id: String(r.id),
    status: r.status as Status,
    assigneeType: r.assignee_type as AssigneeType,
    paused: Boolean(r.paused),
    lastMessageAt: r.last_message_at ? new Date(r.last_message_at as string) : null,
    customerId: String(r.customer_id),
    customerName: (r.customer_name as string | null) ?? null,
    phoneE164: String(r.phone_e164),
    lastMessageBody: (r.last_body as string | null) ?? null,
    lastMessageDirection: (r.last_direction as "inbound" | "outbound" | null) ?? null,
    lastMessageAtPreview: r.last_created ? new Date(r.last_created as string) : null,
    unreadCount: Number(r.unread ?? 0),
    hasOpenDraft: Boolean(r.has_open_draft),
    hasPendingAction: Boolean(r.has_pending_action),
  }));

  if (filters.activity === "has_reply") {
    return mapped.filter((r) => r.lastMessageDirection === "inbound");
  }
  if (filters.activity === "scheduled") {
    return mapped.filter((r) => r.hasOpenDraft);
  }
  return mapped;
}
