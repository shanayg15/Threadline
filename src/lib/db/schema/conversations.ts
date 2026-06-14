import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, uuidPk } from "./_shared";
import { brands } from "./brands";
import { customers } from "./customers";
import {
  assigneeType,
  conversationChannel,
  conversationStatus,
  deliveryStatus,
  messageApprovalStatus,
  messageDirection,
  messageSender,
} from "./enums";
import { users } from "./users";

/** `conversations` — one persistent thread per customer per brand. */
export const conversations = pgTable(
  "conversations",
  {
    id: uuidPk(),
    brandId: uuid()
      .notNull()
      .references(() => brands.id),
    customerId: uuid()
      .notNull()
      .references(() => customers.id),
    channel: conversationChannel().notNull().default("sms"),
    status: conversationStatus().notNull().default("automated"),
    assigneeType: assigneeType().notNull().default("ai"),
    assigneeUserId: uuid().references(() => users.id),
    paused: boolean().notNull().default(false),
    lastMessageAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("conversations_brand_status_idx").on(t.brandId, t.status),
    index("conversations_brand_last_message_idx").on(t.brandId, t.lastMessageAt),
    index("conversations_customer_idx").on(t.customerId),
  ],
);

/** `messages` — every inbound/outbound message in a conversation. */
export const messages = pgTable(
  "messages",
  {
    id: uuidPk(),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id),
    brandId: uuid()
      .notNull()
      .references(() => brands.id),
    direction: messageDirection().notNull(),
    sender: messageSender().notNull(),
    body: text(),
    mediaUrls: jsonb().$type<string[]>(),
    channelMessageId: text(),
    deliveryStatus: deliveryStatus(),
    // Supervised mode (M7): an outbound agent reply is held as a draft (approvalStatus
    // 'pending') instead of being sent, until a human approves/rejects it.
    approvalStatus: messageApprovalStatus(),
    approvedByUserId: uuid().references(() => users.id),
    costCents: integer(),
    model: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index("messages_conversation_created_idx").on(t.conversationId, t.createdAt),
    // Idempotency: a provider message id (Twilio MessageSid, or our mock id) is unique
    // per brand. Lets the inbound webhook dedupe Twilio retries and backstops a
    // double-delivery race at the DB so a STOP is never confirmed twice.
    uniqueIndex("messages_brand_channel_msg_id_uniq")
      .on(t.brandId, t.channelMessageId)
      .where(sql`${t.channelMessageId} is not null`),
    // At most one held draft awaiting approval per conversation.
    uniqueIndex("messages_one_open_draft_per_conversation")
      .on(t.conversationId)
      .where(sql`${t.approvalStatus} = 'pending'`),
  ],
);
