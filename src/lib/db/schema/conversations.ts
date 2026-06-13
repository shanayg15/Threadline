import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
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
    costCents: integer(),
    model: text(),
    createdAt: createdAt(),
  },
  (t) => [index("messages_conversation_created_idx").on(t.conversationId, t.createdAt)],
);
