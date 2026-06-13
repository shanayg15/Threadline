import { pgEnum } from "drizzle-orm/pg-core";

/** Shared Postgres enum types, reused across the schema. */

export const userRole = pgEnum("user_role", ["owner", "agent", "viewer"]);

export const integrationKind = pgEnum("integration_kind", [
  "shopify",
  "twilio",
  "slack",
  "easypost",
  "langfuse",
]);
export const integrationStatus = pgEnum("integration_status", [
  "connected",
  "error",
  "disconnected",
]);

export const consentStatus = pgEnum("consent_status", ["opted_in", "opted_out", "unknown"]);
export const experimentGroup = pgEnum("experiment_group", ["treatment", "control"]);

export const productStatus = pgEnum("product_status", ["active", "archived"]);

export const fulfillmentStatus = pgEnum("fulfillment_status", [
  "unfulfilled",
  "fulfilled",
  "partial",
]);

export const conversationChannel = pgEnum("conversation_channel", [
  "sms",
  "mms",
  "rcs",
  "whatsapp",
  "imessage",
]);
export const conversationStatus = pgEnum("conversation_status", [
  "automated",
  "escalated",
  "blocked",
  "closed",
]);
export const assigneeType = pgEnum("assignee_type", ["ai", "human"]);

export const messageDirection = pgEnum("message_direction", ["inbound", "outbound"]);
export const messageSender = pgEnum("message_sender", ["customer", "ai", "human"]);
export const deliveryStatus = pgEnum("delivery_status", [
  "queued",
  "sent",
  "delivered",
  "failed",
  "received",
]);

export const pendingActionType = pgEnum("pending_action_type", [
  "place_order",
  "create_exchange",
  "modify_subscription",
  "create_checkout_link",
]);
export const pendingActionStatus = pgEnum("pending_action_status", [
  "pending",
  "confirmed",
  "cancelled",
  "expired",
]);

export const eventType = pgEnum("event_type", [
  "order_created",
  "order_fulfilled",
  "order_delivered",
  "payment_failed",
  "no_response",
]);

export const knowledgeSourceType = pgEnum("knowledge_source_type", ["catalog", "policy"]);

export const consentAction = pgEnum("consent_action", ["opt_in", "opt_out", "help", "start"]);

export const auditActor = pgEnum("audit_actor", ["ai", "human", "system"]);
