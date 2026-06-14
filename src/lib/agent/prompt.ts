import type { Message } from "@/lib/db/repos/conversations";
import type { AgentBrand, AgentCustomer, AgentMessage } from "./types";

/** Keep the model focused (and SMS cheap): only the recent turns are sent. */
const MAX_HISTORY = 16;

function voiceBlock(brand: AgentBrand): string {
  const v = brand.voice;
  if (!v) return "";
  const lines = [
    `You are ${v.agentName}, the text-message concierge for ${brand.name}.`,
    `Tone: ${v.formality}. Sound human and concise — this is SMS.`,
  ];
  if (v.toneExemplars.length > 0) {
    lines.push(`Voice examples:\n${v.toneExemplars.map((t) => `- "${t}"`).join("\n")}`);
  }
  if (v.bannedPhrases.length > 0) {
    lines.push(`Never use these phrases: ${v.bannedPhrases.map((p) => `"${p}"`).join(", ")}.`);
  }
  return lines.join("\n");
}

function policyBlock(brand: AgentBrand): string {
  const p = brand.policies;
  if (!p)
    return "No brand policies are on file — if asked about returns/shipping/exchanges and you don't have the answer, escalate rather than guess.";
  const rows = [
    `- Returns: ${p.returns}`,
    `- Shipping: ${p.shipping}`,
    `- Exchanges: ${p.exchange}`,
  ];
  if (p.other) rows.push(`- Other: ${p.other}`);
  return `Brand policies (answer ONLY from these — never invent policy):\n${rows.join("\n")}`;
}

/**
 * The system prompt. The brand voice/policies GROUND the reply; the hard rules below
 * are also enforced deterministically in code (tools + critique) — they are restated
 * here so the model cooperates, but the code is the real guarantee.
 */
export function buildSystemPrompt(brand: AgentBrand, customer: AgentCustomer): string {
  const name = customer.firstName ? ` The customer's name is ${customer.firstName}.` : "";
  return [
    voiceBlock(brand) ||
      `You are the text-message concierge for ${brand.name}. Sound human and concise.`,
    name.trim(),
    "",
    "HARD RULES (do not break):",
    "1. Stock and price come ONLY from the get_variant_live tool, at answer time. Never quote availability or a price from memory or from search results — call the tool.",
    "2. Use search_catalog to find relevant products or policies. To check an order, use get_order_status / get_customer_history.",
    "3. Never invent discounts, promo codes, coupons, prices, or policies. If there is no promotion, say so plainly. If you don't know a policy, escalate.",
    "4. To place an order, create an exchange, or send a checkout link, you MUST use the propose_action tool. This only PROPOSES — nothing is charged, placed, or completed until the customer confirms and it is fulfilled later. NEVER claim you have placed, ordered, charged, processed, refunded, or completed anything.",
    "5. If the customer asks for a human, seems confused or upset, or you are not confident you can help correctly, use the escalate_to_human tool instead of guessing.",
    "6. Keep replies to 1–3 short sentences. Plain text only — no markdown, no links unless a tool gave you one.",
    "",
    policyBlock(brand),
  ]
    .filter((l) => l !== null && l !== undefined)
    .join("\n");
}

/** Convert stored messages into the model's chat history (recent turns only). */
export function toModelMessages(messages: Message[]): AgentMessage[] {
  return messages
    .filter((m) => typeof m.body === "string" && m.body.trim().length > 0)
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      content: m.body as string,
    }));
}

/** The latest inbound customer message — what the agent is replying to. */
export function latestInbound(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.direction === "inbound" && typeof m.body === "string" && m.body.trim()) {
      return m.body;
    }
  }
  return "";
}
