import { and, eq, gte } from "drizzle-orm";

import {
  canSendOutbound,
  type ConsentStatus,
  type FrequencyCaps,
  type QuietHours,
} from "@/lib/compliance";
import { db } from "@/lib/db/client";
import * as audit from "@/lib/db/repos/audit";
import * as conversations from "@/lib/db/repos/conversations";
import { messages } from "@/lib/db/schema";
import { twilioChannel } from "./twilio";

type OutboundBrand = {
  id: string;
  quietHours: QuietHours | null;
  frequencyCaps: FrequencyCaps | null;
};
type OutboundCustomer = {
  id: string;
  phoneE164: string;
  consentStatus: ConsentStatus;
  timezone: string;
};

export type SendOutboundResult =
  | { sent: true; providerMessageId: string }
  | { sent: false; reason: string };

const DAY_MS = 24 * 60 * 60 * 1000;

async function recentOutboundCounts(
  brandId: string,
  conversationId: string,
  now: Date,
): Promise<{ day: number; week: number }> {
  const countSince = async (since: Date) =>
    (
      await db
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.brandId, brandId),
            eq(messages.conversationId, conversationId),
            eq(messages.direction, "outbound"),
            gte(messages.createdAt, since),
          ),
        )
    ).length;
  return {
    day: await countSince(new Date(now.getTime() - DAY_MS)),
    week: await countSince(new Date(now.getTime() - 7 * DAY_MS)),
  };
}

/**
 * Send an outbound message through the channel (mock-gated by SEND_REAL_SMS) and
 * persist it. By default the compliance gate runs (consent + quiet hours + caps,
 * with `isReply` exempting quiet hours/caps). `gate: false` is ONLY for the
 * mandated compliance replies (STOP/HELP/START confirmations), which must send even
 * to an opted-out number.
 */
export async function sendOutbound(
  brand: OutboundBrand,
  customer: OutboundCustomer,
  conversationId: string,
  body: string,
  opts: {
    sender: "ai" | "human";
    isReply?: boolean;
    gate?: boolean;
    mediaUrls?: string[];
    model?: string;
    costCents?: number;
  },
): Promise<SendOutboundResult> {
  const gate = opts.gate ?? true;

  if (gate) {
    const now = new Date();
    const decision = canSendOutbound({
      brand: { quietHours: brand.quietHours, frequencyCaps: brand.frequencyCaps },
      customer: { consentStatus: customer.consentStatus, timezone: customer.timezone },
      now,
      recentOutbound: await recentOutboundCounts(brand.id, conversationId, now),
      isReply: opts.isReply,
    });
    if (!decision.allowed) {
      await audit.record(brand.id, {
        actor: "system",
        action: "outbound_blocked",
        targetType: "conversation",
        targetId: conversationId,
        payload: { reason: decision.reason },
      });
      return { sent: false, reason: decision.reason };
    }
  }

  const result = await twilioChannel.send({
    to: customer.phoneE164,
    body,
    mediaUrls: opts.mediaUrls,
  });

  await conversations.appendMessage(brand.id, {
    conversationId,
    direction: "outbound",
    sender: opts.sender,
    body,
    mediaUrls: opts.mediaUrls ?? null,
    channelMessageId: result.providerMessageId,
    deliveryStatus: result.status,
    model: opts.model ?? null,
    costCents: opts.costCents ?? null,
  });

  return { sent: true, providerMessageId: result.providerMessageId };
}

/** Send a mandated compliance reply (STOP/HELP/START confirmation) — bypasses the
 * send gate so it reaches even a just-opted-out number, and records it. */
export async function sendComplianceReply(
  brand: OutboundBrand,
  customer: OutboundCustomer,
  conversationId: string,
  body: string,
): Promise<SendOutboundResult> {
  // Automated outbound → sender "ai" (messages.sender has no "system"); the
  // auditLog records the true "system" actor for the compliance action.
  return sendOutbound(brand, customer, conversationId, body, {
    sender: "ai",
    gate: false,
    isReply: true,
  });
}
