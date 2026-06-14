import { anthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs } from "ai";

import { env } from "@/lib/config/env";
import { correctionNote } from "./critique";
import { createTools } from "./tools";
import type { AgentModel, ModelRunInput, ModelRunResult } from "./types";

/** Hard cap on the agentic loop — bounds latency, cost, and runaway tool use. */
const MAX_STEPS = 6;

function usageOf(u: { inputTokens?: number; outputTokens?: number }): ModelRunResult["usage"] {
  return { inputTokens: u.inputTokens ?? null, outputTokens: u.outputTokens ?? null };
}

/** The real model: Claude via the Vercel AI SDK, driving the tool loop. */
export class AnthropicAgentModel implements AgentModel {
  readonly name = env.AGENT_MODEL;

  async run({ system, messages, ctx }: ModelRunInput): Promise<ModelRunResult> {
    const { ai } = createTools(ctx);
    const result = await generateText({
      model: anthropic(env.AGENT_MODEL),
      system,
      messages,
      tools: ai,
      stopWhen: stepCountIs(MAX_STEPS),
    });
    return { text: result.text.trim(), model: env.AGENT_MODEL, usage: usageOf(result.totalUsage) };
  }

  /** Text-only rewrite (no tools) so a regeneration can't duplicate side effects. */
  async rewrite(
    { system, messages }: ModelRunInput,
    _draft: string,
    violations: string[],
  ): Promise<ModelRunResult> {
    const result = await generateText({
      model: anthropic(env.AGENT_MODEL),
      system: `${system}\n\n${correctionNote(violations)}`,
      messages,
    });
    return { text: result.text.trim(), model: env.AGENT_MODEL, usage: usageOf(result.totalUsage) };
  }
}
