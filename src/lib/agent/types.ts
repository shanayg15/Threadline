import type { CommerceProvider } from "@/lib/commerce/types";
import type { Policies, VoiceConfig } from "@/lib/db/schema/brands";

/**
 * Agent engine types. The agent answers one customer's SMS thread, grounded in the
 * brand's LIVE Shopify catalog/order data + RAG'd policies, and is governed by hard
 * rules enforced in code (not the model): live stock/price, propose-only side
 * effects, no invented promos/policy, and escalation on confusion / "talk to a person".
 */

/** The brand persona + policy text the model is grounded in. */
export type AgentBrand = {
  id: string;
  name: string;
  voice: VoiceConfig | null;
  policies: Policies | null;
};

/** The customer the thread belongs to (no PII beyond what grounds a reply). */
export type AgentCustomer = {
  id: string;
  firstName: string | null;
  timezone: string;
};

/** One turn of the conversation as the model sees it. */
export type AgentMessage = { role: "user" | "assistant"; content: string };

/**
 * Mutable side-effect ledger threaded through the tool layer. Tools record what they
 * did here so the orchestrator can act on it regardless of which model drove the loop
 * (real Anthropic or the keyless stub).
 */
export type ToolFlags = {
  escalated: boolean;
  escalationReason: string | null;
  /** id of the pending action a propose-only tool created (nothing executes — M8). */
  proposedActionId: string | null;
  toolsUsed: string[];
};

export type ToolContext = {
  brand: AgentBrand;
  customer: AgentCustomer;
  conversationId: string;
  commerce: CommerceProvider;
  flags: ToolFlags;
};

export type ModelUsage = { inputTokens: number | null; outputTokens: number | null };

export type ModelRunResult = {
  /** The model's final natural-language reply (pre-critique). */
  text: string;
  model: string;
  usage: ModelUsage;
};

export type ModelRunInput = {
  system: string;
  messages: AgentMessage[];
  ctx: ToolContext;
};

/** A pluggable model: real Anthropic when keyed, a deterministic stub otherwise. */
export interface AgentModel {
  readonly name: string;
  /** Full agentic loop (tools + multi-step) producing a candidate reply. */
  run(input: ModelRunInput): Promise<ModelRunResult>;
  /** One text-only rewrite when the critique gate rejects the draft (no tools — avoids
   * re-running side effects). May return the draft unchanged to force an escalation. */
  rewrite(input: ModelRunInput, draft: string, violations: string[]): Promise<ModelRunResult>;
}

export type AgentOutcome =
  | {
      status: "replied";
      reply: string;
      escalated: boolean;
      proposedActionId: string | null;
      toolsUsed: string[];
      model: string;
    }
  | { status: "escalated"; reply: string | null; reason: string; toolsUsed: string[] }
  | { status: "skipped"; reason: string }
  | { status: "error"; reason: string };

export function newToolFlags(): ToolFlags {
  return { escalated: false, escalationReason: null, proposedActionId: null, toolsUsed: [] };
}
