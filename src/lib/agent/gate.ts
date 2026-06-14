import { sendOrHold } from "@/lib/channels/outbound";
import { getCommerceProvider } from "@/lib/commerce";
import { attributionCodeFor } from "@/lib/measure/attribution";
import * as auditRepo from "@/lib/db/repos/audit";
import type { Brand } from "@/lib/db/repos/brands";
import * as conversationsRepo from "@/lib/db/repos/conversations";
import * as pendingActionsRepo from "@/lib/db/repos/pendingActions";

import { critiqueReply } from "./critique";
import { latestInbound } from "./prompt";
import type { AgentBrand, AgentOutcome } from "./types";

/**
 * The confirmation gate (M8). When a conversation has an OPEN proposed action (from M6's
 * propose-only tools) and the customer replies, this classifies the reply and — only on
 * an unambiguous CONFIRM — executes the side effect. Money flows via a Shopify checkout
 * link the customer pays; NOTHING is charged here. MODIFY/UNCLEAR never execute.
 *
 * Compliance has already run (this is only reached on the inbound 'proceed' branch), so
 * STOP/HELP/START are filtered out before the gate sees the message.
 */

export type AffirmativeClass = "confirm" | "decline" | "modify" | "unclear";

const MODIFY = /\b(actually|instead|change|different|make it|swap|rather|but)\b/i;
const DECLINE = /^\s*(no|nope|nah|cancel|don'?t|do not|never ?mind|not now|stop that|forget it)\b/i;
const CONFIRM_START =
  /^\s*(yes|yeah|yep|yup|ya|sure|ok|okay|confirm|confirmed|do it|place it|sounds good|go ahead|please do|let'?s do it|absolutely|👍)\b/i;
const CONFIRM_ANY = /\b(confirm|place the order|go ahead and|do it)\b/i;

/** Deterministic affirmative classifier. MODIFY is checked first so "yes but in navy"
 * re-confirms instead of executing; a question or vague reply is UNCLEAR (never executes). */
export function classifyAffirmative(text: string): AffirmativeClass {
  const t = (text ?? "").trim();
  if (!t) return "unclear";
  if (MODIFY.test(t)) return "modify";
  if (DECLINE.test(t)) return "decline";
  if (CONFIRM_START.test(t) || CONFIRM_ANY.test(t)) return "confirm";
  return "unclear";
}

type Convo = NonNullable<Awaited<ReturnType<typeof conversationsRepo.getWithMessages>>>;

function gateOutcome(
  action: "executed" | "declined" | "unclear" | "escalated",
  pendingActionId: string,
  sent: boolean,
  reply: string | null,
): AgentOutcome {
  return { status: "gate", action, pendingActionId, sent, reply };
}

/** Returns { handled: true, outcome } when the gate took over; { handled: false } when
 * the inbound should fall through to the normal agent run (no open action, or MODIFY). */
export async function runConfirmationGate(
  brandRow: Brand,
  convo: Convo,
): Promise<{ handled: boolean; outcome?: AgentOutcome }> {
  const open = await pendingActionsRepo.getOpen(brandRow.id, convo.id);
  if (!open || !convo.customer) return { handled: false };

  const cls = classifyAffirmative(latestInbound(convo.messages));
  const brand: AgentBrand = {
    id: brandRow.id,
    name: brandRow.name,
    voice: brandRow.voiceConfig,
    policies: brandRow.policies,
    supervisedMode: brandRow.supervisedMode,
  };
  const sendBrand = {
    id: brandRow.id,
    quietHours: brandRow.quietHours,
    frequencyCaps: brandRow.frequencyCaps,
  };
  const sendCustomer = {
    id: convo.customer.id,
    phoneE164: convo.customer.phoneE164,
    consentStatus: convo.customer.consentStatus,
    timezone: convo.customer.timezone,
  };

  async function reply(action: "declined" | "unclear" | "escalated", body: string) {
    const safe = critiqueReply(body, brand).ok ? body : "Let me get a teammate to help with this.";
    const res = await sendOrHold(sendBrand, sendCustomer, convo.id, safe, {
      sender: "ai",
      isReply: true,
      supervised: brand.supervisedMode,
    });
    return gateOutcome(action, open!.id, res.outcome === "sent", safe);
  }

  if (cls === "modify") {
    // The customer wants something different — drop the stale proposal and let the normal
    // agent run re-propose from the new request.
    await pendingActionsRepo.cancel(brandRow.id, open.id);
    await auditRepo.record(brandRow.id, {
      actor: "system",
      action: "action_modified",
      targetType: "pending_action",
      targetId: open.id,
      payload: { conversationId: convo.id },
    });
    return { handled: false };
  }

  if (cls === "unclear") {
    await auditRepo.record(brandRow.id, {
      actor: "ai",
      action: "action_clarify",
      targetType: "pending_action",
      targetId: open.id,
      payload: { conversationId: convo.id },
    });
    return {
      handled: true,
      outcome: await reply(
        "unclear",
        "Just to confirm — reply YES to go ahead, or tell me what you'd like to change.",
      ),
    };
  }

  if (cls === "decline") {
    await pendingActionsRepo.cancel(brandRow.id, open.id);
    await auditRepo.record(brandRow.id, {
      actor: "human",
      action: "action_declined",
      targetType: "pending_action",
      targetId: open.id,
      payload: { conversationId: convo.id },
    });
    return {
      handled: true,
      outcome: await reply("declined", "No problem — I won't set that up. Anything else I can help with?"),
    };
  }

  // cls === "confirm" → execute.
  return { handled: true, outcome: await execute(brandRow, brand, sendBrand, sendCustomer, convo, open) };
}

async function escalate(
  brandRow: Brand,
  sendBrand: { id: string; quietHours: Brand["quietHours"]; frequencyCaps: Brand["frequencyCaps"] },
  sendCustomer: { id: string; phoneE164: string; consentStatus: "opted_in" | "opted_out" | "unknown"; timezone: string },
  convo: Convo,
  open: { id: string },
  reason: string,
  body: string,
  supervised: boolean,
): Promise<AgentOutcome> {
  await conversationsRepo.setStatus(brandRow.id, convo.id, "escalated");
  await conversationsRepo.setAssignee(brandRow.id, convo.id, { type: "human" });
  await auditRepo.record(brandRow.id, {
    actor: "system",
    action: "action_escalated",
    targetType: "pending_action",
    targetId: open.id,
    payload: { conversationId: convo.id, reason },
  });
  const res = await sendOrHold(sendBrand, sendCustomer, convo.id, body, {
    sender: "ai",
    isReply: true,
    supervised,
  });
  return gateOutcome("escalated", open.id, res.outcome === "sent", body);
}

async function execute(
  brandRow: Brand,
  brand: AgentBrand,
  sendBrand: { id: string; quietHours: Brand["quietHours"]; frequencyCaps: Brand["frequencyCaps"] },
  sendCustomer: { id: string; phoneE164: string; consentStatus: "opted_in" | "opted_out" | "unknown"; timezone: string },
  convo: Convo,
  open: NonNullable<Awaited<ReturnType<typeof pendingActionsRepo.getOpen>>>,
): Promise<AgentOutcome> {
  const supervised = brandRow.supervisedMode;
  const payload = open.payload ?? {};
  const variantId = typeof payload.variantId === "string" ? payload.variantId : null;
  const quantity = typeof payload.quantity === "number" && payload.quantity > 0 ? payload.quantity : 1;

  // modify_subscription is out of V1 — escalate honestly rather than fake success.
  if (open.type === "modify_subscription") {
    await pendingActionsRepo.cancel(brandRow.id, open.id);
    return escalate(
      brandRow,
      sendBrand,
      sendCustomer,
      convo,
      open,
      "subscription change out of V1",
      "Thanks for confirming — I'll have a teammate set up that subscription change and follow up here.",
      supervised,
    );
  }

  // place_order / create_checkout_link / create_exchange → a customer-paid checkout link.
  if (!variantId) {
    await pendingActionsRepo.cancel(brandRow.id, open.id);
    return escalate(
      brandRow,
      sendBrand,
      sendCustomer,
      convo,
      open,
      "no variant to check out",
      "Thanks for confirming — a teammate will get that finalized and follow up here shortly.",
      supervised,
    );
  }

  // Stamp a per-conversation attribution code on the link so the resulting order can be
  // matched back to this thread (M8 attribution). No card is charged — customer pays.
  const code = attributionCodeFor(convo.id);
  await conversationsRepo.setAttributionCode(brandRow.id, convo.id, code);

  let url: string;
  try {
    const commerce = await getCommerceProvider(brandRow.id);
    ({ url } = await commerce.createCheckoutLink(
      brandRow.id,
      [{ variantId, quantity }],
      { discountCode: code },
    ));
  } catch (err) {
    await auditRepo.record(brandRow.id, {
      actor: "system",
      action: "action_failed",
      targetType: "pending_action",
      targetId: open.id,
      payload: { conversationId: convo.id, error: err instanceof Error ? err.message : String(err) },
    });
    await pendingActionsRepo.cancel(brandRow.id, open.id);
    return escalate(
      brandRow,
      sendBrand,
      sendCustomer,
      convo,
      open,
      "checkout link failed",
      "I hit a snag setting that up — a teammate will sort it out and follow up here.",
      supervised,
    );
  }

  await pendingActionsRepo.confirm(brandRow.id, open.id);
  await auditRepo.record(brandRow.id, {
    actor: "ai",
    action: "action_executed",
    targetType: "pending_action",
    targetId: open.id,
    payload: { conversationId: convo.id, type: open.type, url, attributionCode: code },
  });

  const noun = open.type === "create_exchange" ? "exchange" : "order";
  const body = `Done! Here's your secure checkout link to finish the ${noun}: ${url} — you'll pay through Shopify, and nothing is charged until you complete it there.`;
  const safe = critiqueReply(body, brand).ok ? body : `Here's your secure checkout link: ${url}`;
  const res = await sendOrHold(sendBrand, sendCustomer, convo.id, safe, {
    sender: "ai",
    isReply: true,
    supervised,
  });
  return gateOutcome("executed", open.id, res.outcome === "sent", safe);
}
