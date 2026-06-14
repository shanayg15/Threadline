import { env } from "@/lib/config/env";
import * as brandsRepo from "@/lib/db/repos/brands";
import * as conversationsRepo from "@/lib/db/repos/conversations";

/**
 * Notify a human (via an incoming Slack webhook) that a conversation escalated. Entirely
 * best-effort: a no-op (logs) when SLACK_WEBHOOK_URL is unset, and NEVER throws — it sits
 * on the agent's fail-safe escalation path, so a Slack outage must not break escalation.
 */
export async function notifyEscalation(
  brandId: string,
  conversationId: string,
  reason: string,
): Promise<void> {
  const link = `${env.APP_URL}/conversations/${conversationId}`;
  if (!env.SLACK_WEBHOOK_URL) {
    console.info("[slack] escalation (no webhook configured)", { conversationId, reason, link });
    return;
  }
  try {
    const [convo, brand] = await Promise.all([
      conversationsRepo.getWithMessages(brandId, conversationId),
      brandsRepo.getById(brandId),
    ]);
    const customer = convo?.customer;
    const recent = (convo?.messages ?? [])
      .filter((m) => typeof m.body === "string" && m.body.trim())
      .slice(-4)
      .map((m) => `${m.direction === "inbound" ? "👤" : "🤖"} ${m.body}`)
      .join("\n");
    const text = [
      `:rotating_light: *Escalation* — ${brand?.name ?? "brand"}`,
      `Customer: ${customer?.name ?? customer?.phoneE164 ?? "unknown"}`,
      `Reason: ${reason}`,
      recent ? `\nRecent:\n${recent}` : "",
      `\n<${link}|Open conversation →>`,
    ]
      .filter(Boolean)
      .join("\n");

    await fetch(env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.error("[slack] notify failed", err instanceof Error ? err.message : String(err));
  }
}
