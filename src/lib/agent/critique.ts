import type { AgentBrand } from "./types";

/**
 * Deterministic critique gate. Runs on the model's candidate reply BEFORE it is sent.
 * This is code, not a model — it cannot be prompt-injected away. It enforces the two
 * concrete, unambiguous failures the agent must never commit in V1:
 *
 *  1. Claiming a side effect was completed ("I've placed/charged/refunded …") — M6 is
 *     propose-only; nothing is ever placed or charged by the agent.
 *  2. Offering an invented promo/discount CODE.
 *
 * Plus the brand's own banned phrases. A failing reply is regenerated once, then (if
 * it still fails) the conversation escalates — a non-compliant message is never sent.
 */

/** First-person past-tense completion claims, and "your X has been …" completions. */
const FALSE_COMPLETION: RegExp[] = [
  /\bi(?:['’]ve| have| just|['’]ve just)?\s*(?:just\s+|already\s+|gone ahead and\s+)?(placed|charged|ordered|processed|refunded|booked|completed|submitted|purchased|cancelled|canceled)\b/i,
  /\byour\s+\w+(?:\s+\w+)?\s+(?:has been|have been|is now|was|been)\s+(placed|charged|processed|refunded|completed|submitted|confirmed|booked|cancelled|canceled)\b/i,
  /\b(payment|order|refund|charge|exchange|return)\s+(?:has been|have been|was|is now)\s+(processed|completed|placed|charged|submitted|confirmed|refunded)\b/i,
  /\bi(?:['’]ve| have)\s+(?:gone ahead and\s+)?set\s+(?:that|it|this|you)\s+up\b/i,
];

/** A code-looking token (letters then a digit, e.g. SAVE20) co-occurring with a promo word. */
const CODE_TOKEN = /\b[A-Z]{2,}[A-Z0-9]*\d[A-Z0-9]*\b/;
const PROMO_WORD = /\b(promo|coupon|discount|code|%\s?off|percent off)\b/i;

export type Critique = { ok: boolean; violations: string[] };

export function critiqueReply(reply: string, brand: AgentBrand): Critique {
  const violations: string[] = [];
  const text = reply ?? "";

  if (FALSE_COMPLETION.some((re) => re.test(text))) {
    violations.push(
      "claims a side effect was completed (placed/charged/processed) — the agent only proposes; nothing is executed",
    );
  }

  if (CODE_TOKEN.test(text) && PROMO_WORD.test(text)) {
    violations.push("offers a promo/discount code — the agent must never invent promotions");
  }

  for (const phrase of brand.voice?.bannedPhrases ?? []) {
    if (phrase && text.toLowerCase().includes(phrase.toLowerCase())) {
      violations.push(`uses a brand-banned phrase: "${phrase}"`);
    }
  }

  return { ok: violations.length === 0, violations };
}

/** A short correction note fed back to the model on the single regeneration attempt. */
export function correctionNote(violations: string[]): string {
  return [
    "Your previous draft was rejected by the compliance check for these reasons:",
    ...violations.map((v) => `- ${v}`),
    "Rewrite the reply. Do NOT claim anything was placed, charged, or completed — you only propose and ask the customer to confirm. Do NOT offer any promo code. Keep it short and on-brand.",
  ].join("\n");
}
