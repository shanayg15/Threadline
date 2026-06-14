import type { ModelUsage } from "./types";

/**
 * Rough USD pricing per 1M tokens, by model family. Used only for an approximate
 * per-message cost estimate stored alongside the reply / sent to the trace — it is
 * NOT billing-grade. Unknown models fall back to the Sonnet tier.
 */
const PRICING: Array<{ match: RegExp; inPerM: number; outPerM: number }> = [
  { match: /opus/i, inPerM: 15, outPerM: 75 },
  { match: /sonnet/i, inPerM: 3, outPerM: 15 },
  { match: /haiku/i, inPerM: 0.8, outPerM: 4 },
];

function rate(model: string): { inPerM: number; outPerM: number } {
  return PRICING.find((p) => p.match.test(model)) ?? { inPerM: 3, outPerM: 15 };
}

/** Estimated cost in whole cents (rounded). Returns null when usage is unknown. */
export function estimateCostCents(model: string, usage: ModelUsage): number | null {
  if (usage.inputTokens == null && usage.outputTokens == null) return null;
  const { inPerM, outPerM } = rate(model);
  const dollars =
    ((usage.inputTokens ?? 0) / 1_000_000) * inPerM +
    ((usage.outputTokens ?? 0) / 1_000_000) * outPerM;
  return Math.round(dollars * 100);
}
