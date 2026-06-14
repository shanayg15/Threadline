import { Langfuse } from "langfuse";

import { env } from "@/lib/config/env";

/**
 * Optional Langfuse tracing. Entirely best-effort: when the keys aren't set (or
 * anything throws) every call is a no-op, so tracing never affects whether a customer
 * gets a reply. When configured, each agent turn becomes one trace with its input,
 * the chosen reply, tools used, model, and cost.
 */

let client: Langfuse | null | undefined;

function getClient(): Langfuse | null {
  if (client !== undefined) return client;
  if (env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY) {
    try {
      client = new Langfuse({
        publicKey: env.LANGFUSE_PUBLIC_KEY,
        secretKey: env.LANGFUSE_SECRET_KEY,
        baseUrl: env.LANGFUSE_BASEURL,
      });
    } catch {
      client = null;
    }
  } else {
    client = null;
  }
  return client;
}

export type AgentTrace = {
  update(data: { output?: unknown; metadata?: Record<string, unknown> }): void;
  end(): Promise<void>;
};

const NOOP: AgentTrace = { update() {}, async end() {} };

export function startAgentTrace(opts: {
  brandId: string;
  conversationId: string;
  input: unknown;
}): AgentTrace {
  const c = getClient();
  if (!c) return NOOP;
  try {
    const trace = c.trace({
      name: "agent.respond",
      input: opts.input,
      metadata: { brandId: opts.brandId, conversationId: opts.conversationId },
    });
    return {
      update(data) {
        try {
          trace.update(data);
        } catch {
          /* tracing is best-effort */
        }
      },
      async end() {
        try {
          await c.flushAsync();
        } catch {
          /* tracing is best-effort */
        }
      },
    };
  } catch {
    return NOOP;
  }
}
