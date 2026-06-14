import { env } from "@/lib/config/env";
import { AnthropicAgentModel } from "./model-anthropic";
import { StubAgentModel } from "./model-stub";
import type { AgentModel } from "./types";

/**
 * Resolve the agent model: the real Claude model when ANTHROPIC_API_KEY is set, else
 * the deterministic keyless stub. Mirrors the rest of the stack (mock commerce, local
 * embedder, mocked SMS) so the whole product runs end-to-end without any secrets.
 */
export function getAgentModel(): AgentModel {
  return env.ANTHROPIC_API_KEY ? new AnthropicAgentModel() : new StubAgentModel();
}

export function usingRealModel(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}
