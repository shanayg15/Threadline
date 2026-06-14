import { critiqueReply } from "@/lib/agent/critique";
import { getAgentModel } from "@/lib/agent/model";
import { buildSystemPrompt } from "@/lib/agent/prompt";
import {
  newToolFlags,
  type AgentCustomer,
  type AgentMessage,
  type ToolContext,
} from "@/lib/agent/types";

import { EVAL_BRAND, createProposalSink, fixtureCommerce, fixtureListVariants } from "./fixtures";

export type ScenarioInput = {
  message: string;
  history?: AgentMessage[];
  customerName?: string;
};

export type ScenarioResult = {
  status: "replied" | "escalated";
  reply: string;
  toolsUsed: string[];
  escalated: boolean;
  proposedActionType: string | null;
};

/**
 * Run the agent's prompt-sensitive core — the model loop (real Claude when keyed, the
 * deterministic stub otherwise), the propose-only tools, and the critique gate —
 * against the in-memory fixtures. No DB, no send. This is what the eval cases assert
 * on, so editing the system prompt / tools / critique re-runs these guardrails.
 */
export async function runScenario(input: ScenarioInput): Promise<ScenarioResult> {
  const flags = newToolFlags();
  const sink = createProposalSink();
  const customer: AgentCustomer = {
    id: "eval-customer",
    firstName: input.customerName ?? null,
    timezone: "America/New_York",
  };
  const ctx: ToolContext = {
    brand: EVAL_BRAND,
    customer,
    conversationId: "eval-conv",
    commerce: fixtureCommerce,
    flags,
    listVariants: fixtureListVariants,
    proposals: sink.store,
  };

  const system = buildSystemPrompt(EVAL_BRAND, customer);
  const messages: AgentMessage[] = [
    ...(input.history ?? []),
    { role: "user", content: input.message },
  ];
  const model = getAgentModel();
  const runInput = { system, messages, ctx };

  let draft = await model.run(runInput);
  let critique = critiqueReply(draft.text, EVAL_BRAND);
  if (!critique.ok) {
    draft = await model.rewrite(runInput, draft.text, critique.violations);
    critique = critiqueReply(draft.text, EVAL_BRAND);
  }

  const reply = draft.text.trim();
  const escalated = flags.escalated || !critique.ok || reply.length === 0;
  return {
    status: escalated ? "escalated" : "replied",
    reply: critique.ok && reply.length > 0 ? reply : "[escalated to a human teammate]",
    toolsUsed: flags.toolsUsed,
    escalated,
    proposedActionType: sink.created[0]?.type ?? null,
  };
}
