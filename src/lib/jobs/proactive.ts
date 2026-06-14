import { sendOrHold } from "@/lib/channels/outbound";
import { canSendOutbound } from "@/lib/compliance";
import { critiqueReply } from "@/lib/agent/critique";
import type { AgentBrand } from "@/lib/agent/types";
import * as auditRepo from "@/lib/db/repos/audit";
import * as brandsRepo from "@/lib/db/repos/brands";
import type { Brand } from "@/lib/db/repos/brands";
import * as conversationsRepo from "@/lib/db/repos/conversations";
import type { Customer } from "@/lib/db/repos/customers";
import * as customersRepo from "@/lib/db/repos/customers";
import * as messagesRepo from "@/lib/db/repos/messages";

import { enqueueOutbound, type OutboundJobData } from "./queues";

/** One no-response reminder, N days after the check-in. */
const REMINDER_DELAY_MS = 2 * 24 * 60 * 60 * 1000;

function firstName(name: string | null): string {
  const n = name?.trim().split(/\s+/)[0];
  return n && n.length > 0 ? ` ${n}` : "";
}

/** Compose the proactive message from the playbook + brand voice. Deterministic + safe
 * (so it runs keyless and always clears the critique); the model can refine wording later. */
export function composeProactiveMessage(brand: Brand, customer: Customer, kind: string): string {
  const name = firstName(customer.name);
  const agent = brand.voiceConfig?.agentName ?? "the team";
  if (kind === "no_response_reminder") {
    return `Hi${name}, just circling back — how did everything work out with your order? Happy to help with a swap, sizing, or anything else.`;
  }
  return `Hi${name}! Your order should have arrived — how's everything looking? If anything isn't quite right, just reply here and ${agent} will help sort it out.`;
}

/** Whether the customer replied since the most recent DELIVERED outbound. A held/rejected
 * supervised draft was never sent, so it doesn't count as the last outbound (otherwise a
 * reminder could fire about a check-in the customer never actually received). */
function repliedSinceLastDelivered(
  messages: { direction: string; createdAt: Date; approvalStatus: string | null }[],
): boolean {
  let last = new Date(0);
  for (const m of messages) {
    const delivered =
      m.direction === "outbound" && (m.approvalStatus == null || m.approvalStatus === "approved");
    if (delivered && m.createdAt > last) last = m.createdAt;
  }
  return messages.some((m) => m.direction === "inbound" && m.createdAt > last);
}

/**
 * Process one scheduled outbound send. RE-CHECKS consent + holdout + paused + compliance
 * at send time (state can change after scheduling), composes + critiques the message,
 * sends it (or holds a supervised draft), and — for the check-in — schedules a single
 * capped no-response reminder that self-cancels if the customer has engaged.
 */
export async function runOutboundJob(data: OutboundJobData): Promise<void> {
  const [brand, customer] = await Promise.all([
    brandsRepo.getById(data.brandId),
    customersRepo.getById(data.brandId, data.customerId),
  ]);
  if (!brand || !customer) return;

  const skip = async (reason: string) =>
    auditRepo.record(data.brandId, {
      actor: "system",
      action: "proactive_skipped",
      targetType: "conversation",
      targetId: data.conversationId,
      payload: { reason, kind: data.kind, playbook: data.playbookKey },
    });

  // Re-check the gates at send time.
  if (customer.consentStatus !== "opted_in") return void (await skip("not opted in"));
  // Holdout at send: only treatment is ever messaged (mirrors the scheduling check exactly).
  if (customer.experimentGroup !== "treatment") return void (await skip("holdout"));
  const conversation = await conversationsRepo.getById(data.brandId, data.conversationId);
  if (!conversation) return;
  if (conversation.paused) return void (await skip("conversation paused"));

  const messages = await messagesRepo.listForConversation(data.brandId, data.conversationId);
  if (data.kind === "no_response_reminder" && repliedSinceLastDelivered(messages)) {
    return void (await skip("customer already engaged — reminder cancelled"));
  }

  const text = composeProactiveMessage(brand, customer, data.kind);
  const agentBrand: AgentBrand = {
    id: brand.id,
    name: brand.name,
    voice: brand.voiceConfig,
    policies: brand.policies,
    supervisedMode: brand.supervisedMode,
  };
  if (!critiqueReply(text, agentBrand).ok) return void (await skip("critique blocked"));

  // sendOrHold runs the compliance gate (opt-out absolute, quiet hours, caps) for a
  // proactive (non-reply) send, or holds a supervised draft for approval.
  const res = await sendOrHold(
    { id: brand.id, quietHours: brand.quietHours, frequencyCaps: brand.frequencyCaps },
    {
      id: customer.id,
      phoneE164: customer.phoneE164,
      consentStatus: customer.consentStatus,
      timezone: customer.timezone,
    },
    data.conversationId,
    text,
    { sender: "ai", isReply: false, supervised: brand.supervisedMode },
  );
  if (res.outcome === "blocked") return void (await skip(`compliance: ${res.reason}`));

  await auditRepo.record(data.brandId, {
    actor: "ai",
    action: res.outcome === "held" ? "proactive_drafted" : "proactive_sent",
    targetType: "conversation",
    targetId: data.conversationId,
    payload: { kind: data.kind, playbook: data.playbookKey },
  });

  // Schedule a SINGLE capped no-response reminder — only when the check-in actually went out
  // (a held supervised draft schedules none), at a quiet-hours-respecting time.
  if (data.kind === "delivery_checkin" && res.outcome === "sent") {
    const now = new Date();
    let reminderAt = new Date(now.getTime() + REMINDER_DELAY_MS);
    const decision = canSendOutbound({
      brand: { quietHours: brand.quietHours, frequencyCaps: brand.frequencyCaps },
      customer: { consentStatus: customer.consentStatus, timezone: customer.timezone },
      now: reminderAt,
      isReply: false,
    });
    if (!decision.allowed && decision.nextAllowedAt && decision.reason.includes("quiet")) {
      reminderAt = decision.nextAllowedAt;
    }
    await enqueueOutbound(
      { ...data, kind: "no_response_reminder" },
      { delayMs: reminderAt.getTime() - now.getTime(), jobId: `reminder__${data.conversationId}` },
    );
  }
}
