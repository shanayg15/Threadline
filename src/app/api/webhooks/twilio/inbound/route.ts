import { NextResponse, type NextRequest } from "next/server";

import { sendComplianceReply } from "@/lib/channels/outbound";
import { resolveBrandByNumber } from "@/lib/channels/resolve";
import { twilioChannel } from "@/lib/channels/twilio";
import { evaluateInbound } from "@/lib/compliance";
import * as auditRepo from "@/lib/db/repos/audit";
import * as consentRepo from "@/lib/db/repos/consent";
import * as conversationsRepo from "@/lib/db/repos/conversations";
import * as customersRepo from "@/lib/db/repos/customers";
import * as messagesRepo from "@/lib/db/repos/messages";

// twilio SDK + pg + crypto; PUBLIC route (middleware excludes /api); never cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Twilio inbound SMS/MMS webhook. Verifies the signature, lands the inbound into a
 * conversation, and runs the DETERMINISTIC compliance gate before anything else —
 * STOP/HELP/START/consent are decided here, never by the LLM. On `proceed` the
 * message is handed to the agent (M6 — stubbed here). Returns 200 fast.
 *
 * Fail-safe + idempotent: processing is wrapped so an unexpected error returns a
 * controlled 200 (logged) instead of a 500 — a 5xx makes Twilio RETRY, which would
 * re-run the decision and could send a SECOND opt-out confirmation to a number that
 * just opted out. We also dedupe on the provider MessageSid so a genuine duplicate
 * delivery is a no-op (and a DB unique index backstops a concurrent race). Consent
 * side effects are ordered before the confirmation send so a partial failure leaves
 * the customer correctly opted out rather than confirmed-but-still-subscribed.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!twilioChannel.verifySignature(req, rawBody)) {
    return new NextResponse("invalid signature", { status: 403 });
  }

  const inbound = twilioChannel.parseInbound(req, rawBody);
  if (!inbound.from || !inbound.to) {
    return NextResponse.json({ ok: true, note: "missing from/to" });
  }

  try {
    return await handleInbound(inbound);
  } catch (err) {
    // Swallow into a 200 so Twilio does NOT retry-and-double-send; log for ops.
    console.error("[twilio/inbound] processing error", {
      messageSid: inbound.providerMessageId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: true, note: "error logged" });
  }
}

type Inbound = ReturnType<typeof twilioChannel.parseInbound>;

async function handleInbound(inbound: Inbound): Promise<NextResponse> {
  const brand = await resolveBrandByNumber(inbound.to);
  if (!brand) {
    // Unknown/ambiguous sending number — acknowledge so Twilio doesn't retry.
    return NextResponse.json({ ok: true, note: "unrouted number" });
  }

  // Idempotency: if we already recorded this MessageSid, a Twilio retry / duplicate
  // delivery is reaching us again — short-circuit before re-running side effects.
  if (
    inbound.providerMessageId &&
    (await messagesRepo.existsByChannelId(brand.id, inbound.providerMessageId))
  ) {
    return NextResponse.json({ ok: true, note: "duplicate" });
  }

  const customer = await customersRepo.upsertByPhone(brand.id, inbound.from, {});
  const conversation = await conversationsRepo.getOrCreateForCustomer(brand.id, customer.id, "sms");

  // Record every inbound message for the audit trail (incl. STOP/blocked).
  await conversationsRepo.appendMessage(brand.id, {
    conversationId: conversation.id,
    direction: "inbound",
    sender: "customer",
    body: inbound.body,
    mediaUrls: inbound.mediaUrls.length > 0 ? inbound.mediaUrls : null,
    channelMessageId: inbound.providerMessageId,
    deliveryStatus: "received",
  });

  const supportContact =
    typeof brand.channelConfig?.supportContact === "string"
      ? brand.channelConfig.supportContact
      : undefined;

  const decision = evaluateInbound({
    brand: { brandName: brand.name, supportContact },
    customer: { consentStatus: customer.consentStatus },
    messageBody: inbound.body,
  });

  const brandCtx = {
    id: brand.id,
    quietHours: brand.quietHours,
    frequencyCaps: brand.frequencyCaps,
  };
  const customerCtx = {
    id: customer.id,
    phoneE164: customer.phoneE164,
    consentStatus: customer.consentStatus,
    timezone: customer.timezone,
  };

  switch (decision.action) {
    case "opt_out":
      await customersRepo.setConsent(brand.id, customer.id, {
        status: "opted_out",
        source: "sms_stop",
        optedOutAt: new Date(),
      });
      await consentRepo.record(brand.id, {
        action: "opt_out",
        customerId: customer.id,
        source: "sms",
        rawMessage: inbound.body,
      });
      await auditRepo.record(brand.id, {
        actor: "system",
        action: "consent_opt_out",
        targetType: "customer",
        targetId: customer.id,
      });
      await sendComplianceReply(brandCtx, customerCtx, conversation.id, decision.reply);
      break;

    case "help":
      await consentRepo.record(brand.id, {
        action: "help",
        customerId: customer.id,
        source: "sms",
        rawMessage: inbound.body,
      });
      await sendComplianceReply(brandCtx, customerCtx, conversation.id, decision.reply);
      break;

    case "resume":
      await customersRepo.setConsent(brand.id, customer.id, {
        status: "opted_in",
        source: "sms_start",
        at: new Date(),
        optedOutAt: null,
      });
      await consentRepo.record(brand.id, {
        action: "start",
        customerId: customer.id,
        source: "sms",
        rawMessage: inbound.body,
      });
      await auditRepo.record(brand.id, {
        actor: "system",
        action: "consent_resume",
        targetType: "customer",
        targetId: customer.id,
      });
      await sendComplianceReply(brandCtx, customerCtx, conversation.id, decision.reply);
      break;

    case "blocked":
      // Opted-out customer's normal message: recorded above, no reply, no agent.
      await conversationsRepo.setStatus(brand.id, conversation.id, "blocked");
      await auditRepo.record(brand.id, {
        actor: "system",
        action: "inbound_blocked",
        targetType: "conversation",
        targetId: conversation.id,
        payload: { reason: decision.reason },
      });
      break;

    case "proceed":
      // TODO(M6): hand off to Agent.respond(conversation.id) in a background task /
      // queue (the webhook must stay fast). M5 only lands the cleared inbound.
      await auditRepo.record(brand.id, {
        actor: "system",
        action: "inbound_received",
        targetType: "conversation",
        targetId: conversation.id,
      });
      break;
  }

  return NextResponse.json({ ok: true });
}
