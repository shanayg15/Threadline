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

// We match against an apostrophe-STRIPPED copy so "I've" and the apostrophe-less SMS
// form "Ive" are caught by the same pattern.
const FALSE_COMPLETION: RegExp[] = [
  // First-person past-tense completion: "Ive placed", "I just charged", "I went ahead and refunded"
  /\bi\s?(?:ve|have|just|ve just)?\s*(?:just|already|gone ahead and|went ahead and)?\s*(placed|charged|ordered|processed|refunded|issued|booked|completed|submitted|purchased|cancelled|canceled)\b/i,
  // "I('ve) created/set up your order/exchange/checkout…" (only with a side-effect object)
  /\bi\s?(?:ve|have)?\s*(?:gone ahead and\s+|went ahead and\s+)?(?:created|set up|set)\s+(?:that|it|this|you|your|the|a)\s*(order|exchange|return|checkout|subscription|up)\b/i,
  // "your <thing> has been/was/is now <completed>"
  /\byour\s+\w+(?:\s+\w+)?\s+(?:has been|have been|is now|was|been)\s+(placed|charged|processed|refunded|issued|created|completed|submitted|confirmed|booked|cancelled|canceled)\b/i,
  // "<payment|order|…> has been/was <processed|…>"
  /\b(payment|order|refund|charge|exchange|return)\s+(?:has been|have been|was|is now)\s+(processed|completed|placed|charged|issued|submitted|confirmed|refunded)\b/i,
];

// Promo-code detection. An OFFERED code (use/apply/"promo code is" + a token) is always
// a violation; a bare digit-bearing token is only a code when a promo word is present
// AND it isn't a tracking/order/SKU/gift-card context (those legitimately carry codes).
// Keywords match case-insensitively, but the captured token must be "code-like" (has an
// uppercase letter or a digit) so lowercase words like "now"/"checkout" don't trip it.
const OFFERED_CODE: RegExp[] = [
  /\b(?:use|enter|apply|redeem|with)\s+(?:the\s+)?(?:promo|coupon|discount)?\s*code[:\s]+["'`]?([A-Za-z0-9]{3,})\b/gi,
  /\b(?:promo|coupon|discount)\s+code\b[:\s]*(?:is[:\s]+)?["'`]?([A-Za-z0-9]{3,})\b/gi,
];
const DIGIT_CODE = /\b[A-Z]{2,}[A-Z0-9]*\d[A-Z0-9]*\b/;
const PROMO_CTX = /(\bpromo\b|\bcoupon\b|\bdiscount\b|%\s?off|percent off|\bsave\b)/i;
const NONPROMO_CTX =
  /\b(track|tracking|order\s*(?:number|#|id)|sku|gift\s?card|confirmation|reference)\b/i;

const isCodeLike = (token: string) => /[A-Z0-9]/.test(token);

function offersPromoCode(t: string): boolean {
  for (const re of OFFERED_CODE) {
    for (const m of t.matchAll(re)) {
      if (m[1] && isCodeLike(m[1])) return true;
    }
  }
  return DIGIT_CODE.test(t) && PROMO_CTX.test(t) && !NONPROMO_CTX.test(t);
}

export type Critique = { ok: boolean; violations: string[] };

export function critiqueReply(reply: string, brand: AgentBrand): Critique {
  const violations: string[] = [];
  const t = (reply ?? "").replace(/['’`]/g, "");

  if (FALSE_COMPLETION.some((re) => re.test(t))) {
    violations.push(
      "claims a side effect was completed (placed/charged/processed) — the agent only proposes; nothing is executed",
    );
  }

  if (offersPromoCode(t)) {
    violations.push("offers a promo/discount code — the agent must never invent promotions");
  }

  for (const phrase of brand.voice?.bannedPhrases ?? []) {
    if (phrase && t.toLowerCase().includes(phrase.replace(/['’`]/g, "").toLowerCase())) {
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
