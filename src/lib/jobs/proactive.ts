import { sendOrHold } from "@/lib/channels/outbound";
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

/** Whether the customer has replied since the most recent outbound (engagement check). */
function repliedSinceLastOutbound(messages: { direction: string; createdAt: Date }[]): boolean {
  let lastOutbound = new Date(0);
  for (const m of messages) if (m.direction === "outbound" && m.createdAt > lastOutbound) lastOutbound = m.createdAt;
  return messages.some((m) => m.direction === "inbound" && m.createdAt > lastOutbound);
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
  if (customer.experimentGroup === "control") return void (await skip("holdout")); // holdout at send
  const conversation = await conversationsRepo.getById(data.brandId, data.conversationId);
  if (!conversation) return;
  if (conversation.paused) return void (await skip("conversation paused"));

  const messages = await messagesRepo.listForConversation(data.brandId, data.conversationId);
  if (data.kind === "no_response_reminder" && repliedSinceLastOutbound(messages)) {
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

  // Schedule a SINGLE capped no-response reminder after the check-in (not after a reminder).
  if (data.kind === "delivery_checkin") {
    await enqueueOutbound(
      { ...data, kind: "no_response_reminder" },
      { delayMs: REMINDER_DELAY_MS, jobId: `reminder:${data.conversationId}` },
    );
  }
}
