import { DateTime } from "luxon";

import {
  classifyKeyword,
  helpText,
  optOutConfirmation,
  resumeConfirmation,
  type CannedContext,
} from "./keywords";

export type ConsentStatus = "opted_in" | "opted_out" | "unknown";
export type QuietHours = { start: string; end: string };
export type FrequencyCaps = { perDay: number; perWeek: number };

/**
 * Deterministic compliance gate. PURE functions — they return a decision and never
 * touch the DB; the caller performs the consent/suppression/audit writes the
 * decision implies. The LLM is NEVER involved in any of this.
 */

// ---- Inbound ----

export type InboundDecision =
  | { action: "opt_out"; reply: string }
  | { action: "help"; reply: string }
  | { action: "resume"; reply: string }
  | { action: "blocked"; reason: string }
  | { action: "proceed" };

export type InboundCtx = {
  brand: CannedContext;
  customer: { consentStatus: ConsentStatus } | null;
  messageBody: string;
};

/**
 * Classify an inbound message into a compliance action. Precedence: STOP wins over
 * everything; HELP is always answerable; "YES"/"START" is a RESUME only when the
 * customer is currently opted out — otherwise an affirmative is a normal message
 * that proceeds to the agent/confirmation gate.
 */
export function evaluateInbound(ctx: InboundCtx): InboundDecision {
  const keyword = classifyKeyword(ctx.messageBody);
  const optedOut = ctx.customer?.consentStatus === "opted_out";

  if (keyword === "opt_out") return { action: "opt_out", reply: optOutConfirmation(ctx.brand) };
  if (keyword === "help") return { action: "help", reply: helpText(ctx.brand) };
  if (keyword === "resume") {
    if (optedOut) return { action: "resume", reply: resumeConfirmation(ctx.brand) };
    // "YES"/"START" while not opted out → normal message for the agent/gate.
  }

  if (optedOut) return { action: "blocked", reason: "customer is opted out" };
  return { action: "proceed" };
}

// ---- Outbound ----

export type OutboundDecision =
  | { allowed: true }
  | { allowed: false; reason: string; nextAllowedAt?: Date };

export type OutboundCtx = {
  brand: { quietHours: QuietHours | null; frequencyCaps: FrequencyCaps | null };
  customer: { consentStatus: ConsentStatus; timezone: string };
  now: Date;
  /** Outbound counts within the rolling day/week windows for this customer. */
  recentOutbound?: { day: number; week: number };
  /** True when replying to a customer-initiated inbound (quiet-hours + caps exempt). */
  isReply?: boolean;
};

function parseHm(value: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

/** Is `now`, in the customer's timezone, inside the brand's sendable window? */
function quietHours(
  qh: QuietHours | null,
  timezone: string,
  now: Date,
): { withinWindow: true } | { withinWindow: false; nextAllowedAt: Date } {
  if (!qh) return { withinWindow: true };
  const start = parseHm(qh.start);
  const end = parseHm(qh.end);
  if (!start || !end) return { withinWindow: true };

  const local = DateTime.fromJSDate(now).setZone(timezone);
  if (!local.isValid) return { withinWindow: true }; // unknown tz → don't block

  const nowMin = local.hour * 60 + local.minute;
  const startMin = start.h * 60 + start.m;
  const endMin = end.h * 60 + end.m;

  const within =
    startMin <= endMin
      ? nowMin >= startMin && nowMin < endMin // normal window, e.g. 09:00–21:00
      : nowMin >= startMin || nowMin < endMin; // window crossing midnight
  if (within) return { withinWindow: true };

  // Next sendable instant = the next occurrence of `start` in the customer's tz.
  let next = local.set({ hour: start.h, minute: start.m, second: 0, millisecond: 0 });
  if (next <= local) next = next.plus({ days: 1 });
  return { withinWindow: false, nextAllowedAt: next.toJSDate() };
}

/**
 * Decide whether a brand-initiated (or AI-as-reply) outbound may send NOW. Order:
 * opt-out (absolute) → consent → quiet hours (customer tz, DST-correct) → caps.
 * A reply to a customer-initiated inbound is exempt from quiet hours and caps, but
 * opt-out is still absolute.
 */
export function canSendOutbound(ctx: OutboundCtx): OutboundDecision {
  // STOP / suppression is absolute — never message an opted-out number, ever.
  if (ctx.customer.consentStatus === "opted_out") {
    return { allowed: false, reason: "customer is opted out" };
  }

  if (ctx.isReply) {
    // Answering a customer who just texted us — always OK if not opted out.
    return { allowed: true };
  }

  if (ctx.customer.consentStatus !== "opted_in") {
    return { allowed: false, reason: "customer is not opted in" };
  }

  const qh = quietHours(ctx.brand.quietHours, ctx.customer.timezone, ctx.now);
  if (!qh.withinWindow) {
    return { allowed: false, reason: "outside quiet hours", nextAllowedAt: qh.nextAllowedAt };
  }

  const caps = ctx.brand.frequencyCaps;
  if (caps && ctx.recentOutbound) {
    if (ctx.recentOutbound.day >= caps.perDay) {
      return { allowed: false, reason: "daily frequency cap reached" };
    }
    if (ctx.recentOutbound.week >= caps.perWeek) {
      return { allowed: false, reason: "weekly frequency cap reached" };
    }
  }

  return { allowed: true };
}
