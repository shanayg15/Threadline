/**
 * Deterministic SMS compliance keyword matching (TCPA/CTIA). This is the highest-
 * liability code in the app — pure, exhaustively tested, NEVER the LLM.
 *
 * MATCH RULE: classify on the message's FIRST word, normalized (trimmed,
 * lowercased, surrounding punctuation stripped). This makes "STOP", "stop",
 * "  STOP  ", "Stop.", and "STOP please" all opt-outs, while a sentence that merely
 * contains the word ("please don't stop texting me") is NOT — matching carrier
 * behavior. Precedence: opt-out > help > resume (STOP always wins).
 */

export type KeywordClass = "opt_out" | "help" | "resume";

const OPT_OUT = new Set([
  "stop",
  "stopall",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
  "optout",
  "revoke",
]);
const HELP = new Set(["help", "info"]);
const RESUME = new Set(["start", "yes", "unstop", "optin"]);

/** First word of the message, lowercased with surrounding punctuation removed. */
export function normalizeFirstWord(body: string): string {
  const first = body.trim().split(/\s+/)[0] ?? "";
  return first.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

/**
 * Classify an inbound message's compliance keyword (or null if none). RESUME is
 * returned for START/YES/etc. regardless of consent state — the CALLER decides
 * whether it is an actual resume (only when the customer is opted out); otherwise
 * an affirmative like "YES" is a normal message for the agent/confirmation gate.
 */
export function classifyKeyword(body: string): KeywordClass | null {
  const word = normalizeFirstWord(body);
  if (!word) return null;
  if (OPT_OUT.has(word)) return "opt_out"; // STOP wins over everything
  if (HELP.has(word)) return "help";
  if (RESUME.has(word)) return "resume";
  return null;
}

export type CannedContext = { brandName: string; supportContact?: string };

export function optOutConfirmation({ brandName }: CannedContext): string {
  return `You're unsubscribed from ${brandName} and won't get more messages. Reply START to resubscribe.`;
}

export function helpText({ brandName, supportContact }: CannedContext): string {
  const contact = supportContact ? ` Contact: ${supportContact}.` : "";
  return `${brandName} support. Msg&data rates may apply. Reply STOP to unsubscribe, HELP for help.${contact}`;
}

export function resumeConfirmation({ brandName }: CannedContext): string {
  return `You're resubscribed to ${brandName}. Reply STOP to unsubscribe, HELP for help.`;
}
