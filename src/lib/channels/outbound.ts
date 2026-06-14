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

  let result: Awaited<ReturnType<typeof twilioChannel.send>>;
  try {
    result = await twilioChannel.send({ to: customer.phoneE164, body, mediaUrls: opts.mediaUrls });
  } catch (err) {
    // A real carrier error must not vanish — persist the attempt as a failed message
    // and audit it (the mock send never throws, so dev is unaffected).
    await conversations.appendMessage(brand.id, {
      conversationId,
      direction: "outbound",
      sender: opts.sender,
      body,
      mediaUrls: opts.mediaUrls ?? null,
      channelMessageId: null,
      deliveryStatus: "failed",
      model: opts.model ?? null,
      costCents: opts.costCents ?? null,
    });
    await audit.record(brand.id, {
      actor: "system",
      action: "delivery_failed",
      targetType: "conversation",
      targetId: conversationId,
      payload: { reason: err instanceof Error ? err.message : String(err) },
    });
    return { sent: false, reason: "send failed" };
  }

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

export type SendOrHoldResult =
  | { outcome: "sent"; providerMessageId: string }
  | { outcome: "held"; draftId: string }
  | { outcome: "blocked"; reason: string };

/**
 * Send an agent message OR hold it as a supervised draft (M7/M8). When the brand is in
 * supervised mode the message is held for human approval; otherwise it goes out through
 * the compliance gate. Used by the agent reply path, the confirmation gate, and the
 * proactive lifecycle jobs so all three honor supervised mode + compliance identically.
 */
export async function sendOrHold(
  brand: OutboundBrand,
  customer: OutboundCustomer,
  conversationId: string,
  body: string,
  opts: {
    sender: "ai" | "human";
    isReply?: boolean;
    supervised: boolean;
    model?: string | null;
    costCents?: number | null;
  },
): Promise<SendOrHoldResult> {
  if (opts.supervised) {
    const draft = await conversations.createDraft(brand.id, {
      conversationId,
      body,
      model: opts.model ?? null,
      costCents: opts.costCents ?? null,
    });
    return { outcome: "held", draftId: draft.id };
  }
  const result = await sendOutbound(brand, customer, conversationId, body, {
    sender: opts.sender,
    isReply: opts.isReply,
    model: opts.model ?? undefined,
    costCents: opts.costCents ?? undefined,
  });
  return result.sent
    ? { outcome: "sent", providerMessageId: result.providerMessageId }
    : { outcome: "blocked", reason: result.reason };
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

/**
 * Deliver a supervised-mode draft a human approved: runs the compliance gate, sends via
 * the channel (mock when SEND_REAL_SMS=false), and turns the EXISTING draft row into the
 * sent message in place (no duplicate). Compliance is still honored — an opted-out number
 * is blocked and the draft stays pending. `isReply` exempts quiet hours/caps (a human is
 * approving a reply in the loop). Returns the block reason for the UI when not sent.
 */
export async function deliverHeldDraft(
  brand: OutboundBrand,
  customer: OutboundCustomer,
  conversationId: string,
  draft: { id: string; model: string | null; costCents: number | null },
  body: string,
  opts: { sender: "ai" | "human"; approvedByUserId: string },
): Promise<SendOutboundResult> {
  const now = new Date();
  const decision = canSendOutbound({
    brand: { quietHours: brand.quietHours, frequencyCaps: brand.frequencyCaps },
    customer: { consentStatus: customer.consentStatus, timezone: customer.timezone },
    now,
    recentOutbound: await recentOutboundCounts(brand.id, conversationId, now),
    isReply: true,
  });
  if (!decision.allowed) {
    await audit.record(brand.id, {
      actor: "system",
      action: "outbound_blocked",
      targetType: "conversation",
      targetId: conversationId,
      payload: { reason: decision.reason, draftId: draft.id },
    });
    return { sent: false, reason: decision.reason };
  }

  let result: Awaited<ReturnType<typeof twilioChannel.send>>;
  try {
    result = await twilioChannel.send({ to: customer.phoneE164, body });
  } catch (err) {
    await audit.record(brand.id, {
      actor: "system",
      action: "delivery_failed",
      targetType: "conversation",
      targetId: conversationId,
      payload: { reason: err instanceof Error ? err.message : String(err), draftId: draft.id },
    });
    return { sent: false, reason: "send failed" };
  }

  await conversations.markDraftSent(brand.id, draft.id, {
    sender: opts.sender,
    approvedByUserId: opts.approvedByUserId,
    body,
    channelMessageId: result.providerMessageId,
    deliveryStatus: result.status,
  });
  return { sent: true, providerMessageId: result.providerMessageId };
}
