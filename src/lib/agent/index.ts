import { sendOutbound } from "@/lib/channels/outbound";
import { getCommerceProvider } from "@/lib/commerce";
import * as auditRepo from "@/lib/db/repos/audit";
import * as brandsRepo from "@/lib/db/repos/brands";
import * as conversationsRepo from "@/lib/db/repos/conversations";

import { estimateCostCents } from "./cost";
import { critiqueReply } from "./critique";
import { getAgentModel } from "./model";
import { buildSystemPrompt, latestInbound, toModelMessages } from "./prompt";
import { startAgentTrace } from "./tracing";
import {
  newToolFlags,
  type AgentBrand,
  type AgentCustomer,
  type AgentOutcome,
  type ModelUsage,
  type ToolContext,
} from "./types";

export type { AgentOutcome } from "./types";

/** Bound the whole turn (model + tools + send). The webhook never waits on this. */
const AGENT_TIMEOUT_MS = 30_000;

const HANDOFF_REPLY = "Let me get a teammate to help with this — someone will follow up here shortly.";

function firstNameOf(name: string | null): string | null {
  const n = name?.trim().split(/\s+/)[0];
  return n && n.length > 0 ? n : null;
}

function sumUsage(a: ModelUsage, b: ModelUsage): ModelUsage {
  const add = (x: number | null, y: number | null) =>
    x == null && y == null ? null : (x ?? 0) + (y ?? 0);
  return { inputTokens: add(a.inputTokens, b.inputTokens), outputTokens: add(a.outputTokens, b.outputTokens) };
}

async function sendReply(
  brand: { id: string; quietHours: null; frequencyCaps: null },
  customer: { id: string; phoneE164: string; consentStatus: "opted_in" | "opted_out" | "unknown"; timezone: string },
  conversationId: string,
  body: string,
  model: string,
  costCents: number | null,
): Promise<boolean> {
  // An agent reply answers a customer-initiated inbound → isReply (quiet-hours/caps
  // exempt). The gate still blocks an opted-out number; opted-out never reaches here.
  const result = await sendOutbound(brand, customer, conversationId, body, {
    sender: "ai",
    isReply: true,
    model,
    costCents: costCents ?? undefined,
  });
  return result.sent;
}

async function markEscalated(brandId: string, conversationId: string, reason: string): Promise<void> {
  await conversationsRepo.setStatus(brandId, conversationId, "escalated");
  await conversationsRepo.setAssignee(brandId, conversationId, { type: "human" });
  await auditRepo.record(brandId, {
    actor: "ai",
    action: "agent_escalated",
    targetType: "conversation",
    targetId: conversationId,
    payload: { reason },
  });
}

/**
 * Generate and send the agent's reply for a conversation's latest inbound. Grounded in
 * the brand's live catalog/orders + RAG'd policies, gated by the deterministic critique,
 * propose-only on side effects, and escalating on confusion / "talk to a person".
 *
 * FAIL-SAFE: this never throws. Any unexpected error is caught, audited, and the
 * conversation is escalated to a human so the customer is never left on a broken thread.
 */
export async function respond(brandId: string, conversationId: string): Promise<AgentOutcome> {
  try {
    const convo = await conversationsRepo.getWithMessages(brandId, conversationId);
    if (!convo || !convo.customer) return { status: "skipped", reason: "conversation not found" };

    const customerRow = convo.customer;
    if (customerRow.consentStatus === "opted_out") {
      return { status: "skipped", reason: "customer opted out" };
    }

    const history = toModelMessages(convo.messages);
    const last = history[history.length - 1];
    if (!last || last.role !== "user") return { status: "skipped", reason: "no inbound to answer" };

    const brandRow = await brandsRepo.getById(brandId);
    if (!brandRow) return { status: "skipped", reason: "brand not found" };

    const brand: AgentBrand = {
      id: brandRow.id,
      name: brandRow.name,
      voice: brandRow.voiceConfig,
      policies: brandRow.policies,
    };
    const customer: AgentCustomer = {
      id: customerRow.id,
      firstName: firstNameOf(customerRow.name),
      timezone: customerRow.timezone,
    };

    const commerce = await getCommerceProvider(brandId);
    const flags = newToolFlags();
    const ctx: ToolContext = { brand, customer, conversationId, commerce, flags };
    const system = buildSystemPrompt(brand, customer);
    const model = getAgentModel();
    const trace = startAgentTrace({ brandId, conversationId, input: latestInbound(convo.messages) });

    const input = { system, messages: history, ctx };
    let draft = await model.run(input);
    let usage = draft.usage;

    // Deterministic critique gate: one rewrite, then escalate rather than send bad text.
    let critique = critiqueReply(draft.text, brand);
    if (!critique.ok) {
      const retry = await model.rewrite(input, draft.text, critique.violations);
      usage = sumUsage(usage, retry.usage);
      draft = retry;
      critique = critiqueReply(draft.text, brand);
      if (!critique.ok) {
        flags.escalated = true;
        flags.escalationReason = "reply failed compliance critique";
      }
    }

    const costCents = estimateCostCents(draft.model, usage);
    const sendBrand = { id: brand.id, quietHours: null, frequencyCaps: null };
    const sendCustomer = {
      id: customerRow.id,
      phoneE164: customerRow.phoneE164,
      consentStatus: customerRow.consentStatus,
      timezone: customerRow.timezone,
    };
    const reply = draft.text.trim();

    // Escalation: a tool escalated, the critique forced it, or the model said nothing.
    if (flags.escalated || reply.length === 0) {
      const reason = flags.escalationReason ?? "empty reply";
      await markEscalated(brandId, conversationId, reason);
      const handoff = critique.ok && reply.length > 0 ? reply : HANDOFF_REPLY;
      const sent = await sendReply(sendBrand, sendCustomer, conversationId, handoff, draft.model, costCents);
      trace.update({ output: handoff, metadata: { escalated: true, reason, toolsUsed: flags.toolsUsed } });
      await trace.end();
      return { status: "escalated", reply: sent ? handoff : null, reason, toolsUsed: flags.toolsUsed };
    }

    const sent = await sendReply(sendBrand, sendCustomer, conversationId, reply, draft.model, costCents);
    await auditRepo.record(brandId, {
      actor: "ai",
      action: "agent_replied",
      targetType: "conversation",
      targetId: conversationId,
      payload: {
        toolsUsed: flags.toolsUsed,
        proposedActionId: flags.proposedActionId,
        model: draft.model,
        costCents,
        sent,
      },
    });
    trace.update({
      output: reply,
      metadata: {
        toolsUsed: flags.toolsUsed,
        proposedActionId: flags.proposedActionId,
        model: draft.model,
        costCents,
      },
    });
    await trace.end();

    return {
      status: "replied",
      reply,
      escalated: false,
      proposedActionId: flags.proposedActionId,
      toolsUsed: flags.toolsUsed,
      model: draft.model,
    };
  } catch (err) {
    // Fail safe: never leave the customer hanging — escalate and record the error.
    const reason = err instanceof Error ? err.message : String(err);
    try {
      await markEscalated(brandId, conversationId, `agent error: ${reason}`);
      await auditRepo.record(brandId, {
        actor: "system",
        action: "agent_error",
        targetType: "conversation",
        targetId: conversationId,
        payload: { reason },
      });
    } catch {
      /* swallow — already in the failure path */
    }
    return { status: "error", reason };
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const t = setTimeout(() => resolve(onTimeout), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(onTimeout);
      },
    );
  });
}

/**
 * Fire-and-forget entry point for the webhook: kicks off `respond` with a timeout and
 * never rejects, so the Twilio webhook can return 200 immediately and an agent failure
 * can never 500 it. (M8 moves this onto the durable BullMQ queue.)
 */
export function respondAsync(brandId: string, conversationId: string): void {
  void withTimeout(respond(brandId, conversationId), AGENT_TIMEOUT_MS, {
    status: "error",
    reason: "agent timed out",
  } as AgentOutcome).then((outcome) => {
    if (outcome.status === "error") {
      console.error("[agent] respond failed", { conversationId, reason: outcome.reason });
    }
  });
}

export const Agent = { respond, respondAsync };
