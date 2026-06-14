import { createTools } from "./tools";
import type { AgentModel, ModelRunInput, ModelRunResult, ToolContext } from "./types";

/**
 * Deterministic keyless model. With no ANTHROPIC_API_KEY, this intent-heuristic
 * planner drives the SAME tools as the real model so the whole loop — live reads,
 * propose-only side effects, escalation, compliant phrasing — runs end-to-end in dev
 * and in tests. It is NOT a quality stand-in for the LLM (real prompt quality needs a
 * key + the eval harness); it exists so the engine is verifiable without secrets.
 */
export class StubAgentModel implements AgentModel {
  readonly name = "stub";

  async run({ messages, ctx }: ModelRunInput): Promise<ModelRunResult> {
    const tools = createTools(ctx);
    const last = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const text = await plan(last, ctx, tools.impls);
    return { text, model: "stub", usage: { inputTokens: null, outputTokens: null } };
  }

  /** The stub never produces a critique violation; if it somehow did, return the draft
   * unchanged so the orchestrator escalates rather than sending unvetted text. */
  async rewrite(_input: ModelRunInput, draft: string): Promise<ModelRunResult> {
    return { text: draft, model: "stub", usage: { inputTokens: null, outputTokens: null } };
  }
}

type Impls = ReturnType<typeof createTools>["impls"];

const has = (s: string, re: RegExp) => re.test(s);

async function plan(message: string, ctx: ToolContext, impls: Impls): Promise<string> {
  const text = message.toLowerCase();
  const agentName = ctx.brand.voice?.agentName ?? "the team";
  const brandName = ctx.brand.name;

  // 1) Explicit human request / frustration → escalate.
  if (
    has(
      text,
      /\b(human|real person|a person|representative|rep\b|agent|someone real|talk to (a|someone)|speak (to|with))\b/,
    ) ||
    has(text, /\b(this is ridiculous|useless|frustrat|angry|cancel my|complaint)\b/)
  ) {
    await impls.escalateToHuman({ reason: "customer asked for a human or is frustrated" });
    return `Of course — let me bring in a teammate from ${brandName} to help. Someone will follow up here shortly.`;
  }

  // 2) Order status / tracking.
  if (has(text, /\b(where('?s| is)?|track|tracking|status|shipped|ship|arriv|deliver)\b/)) {
    const history = await impls.getCustomerHistory();
    const latest = history[0];
    if (!latest) {
      await impls.escalateToHuman({ reason: "order-status request but no order on file" });
      return `I don't see a recent order tied to this number — let me get a teammate to look into it for you.`;
    }
    const status = await impls.getOrderStatus({ orderRef: latest.orderId });
    if (status.found && status.trackingNumber) {
      const carrier = status.carrier ? `${status.carrier} ` : "";
      return `Your most recent order is ${status.fulfillmentStatus}. Tracking: ${carrier}${status.trackingNumber}.`;
    }
    if (status.found) return `Your most recent order is currently ${status.fulfillmentStatus}.`;
    return `Let me check on that order — a teammate will follow up shortly with the details.`;
  }

  // 3) Discount / promo fishing ("20% off", "promo code") → never invent a code.
  if (
    has(text, /\b(discount|promo|coupon|code|deal|sale|cheaper|price ?match)\b/) ||
    has(text, /\d+\s?%/)
  ) {
    return `We don't have a promo running right now, but I'm happy to help you find the right piece or size!`;
  }

  // 3b) Billing question ("did you charge me?") → answer honestly, never claim a charge.
  if (has(text, /\b(charge|charged|charging|bill|billed|refunded|my card|my account)\b/)) {
    return `Nothing's been charged through this chat — I can only set things up for you to confirm. Want me to check your order or get a teammate to look into it?`;
  }

  // 4) Policy questions → answer from brand policies, never invent.
  if (
    has(text, /\b(return|refund|exchange policy|shipping|how long|warranty|policy)\b/) &&
    !has(text, /\b(buy|order|exchange this|swap)\b/)
  ) {
    const p = ctx.brand.policies;
    const answer = p
      ? has(text, /\b(return|refund)\b/)
        ? p.returns
        : has(text, /\bship/)
          ? p.shipping
          : has(text, /\bexchange/)
            ? p.exchange
            : (p.other ?? p.returns)
      : undefined;
    if (answer && answer.trim()) return answer;
    await impls.escalateToHuman({ reason: "policy question with no usable policy on file" });
    return `Good question — let me get a teammate to confirm that for you.`;
  }

  // 5) Exchange / swap request → propose-only.
  if (has(text, /\b(exchange|swap|different size|wrong size|return this|send back)\b/)) {
    const history = await impls.getCustomerHistory();
    const orderId = history[0]?.orderId;
    await impls.proposeAction({
      type: "create_exchange",
      summary: `Exchange for the customer's recent order`,
      orderId,
    });
    return `Happy to set up an exchange. Reply YES to confirm and I'll get it started — I won't make any changes until you do.`;
  }

  // 6) Buy / order / checkout → live price-check, then propose-only.
  if (has(text, /\b(buy|order|purchase|checkout|get the|i'?ll take|add to)\b/)) {
    const found = await findVariant(message, impls);
    if (found?.live.found && found.live.inStock) {
      await impls.proposeAction({
        type: "place_order",
        summary: `Order 1x ${found.title}`,
        variantId: found.variantId,
        quantity: 1,
      });
      return `I can set up an order for the ${found.title} at $${found.live.priceUsd}. Reply YES to confirm — nothing's charged until you do.`;
    }
    if (found?.live.found) {
      return `The ${found.title} is out of stock at the moment. Want me to suggest a similar piece or set up an exchange?`;
    }
    await impls.escalateToHuman({ reason: "purchase intent but couldn't price-check a variant" });
    return `Let me get a teammate to help you get that ordered correctly.`;
  }

  // 7) Stock / size / availability / price.
  if (
    has(
      text,
      /\b(in stock|stock|available|availability|do you have|carry|size|fit|color|price|cost|how much)\b/,
    )
  ) {
    const found = await findVariant(message, impls);
    if (found?.live.found && found.live.inStock) {
      return `Yes — the ${found.title} is in stock at $${found.live.priceUsd}. Want me to help you grab one?`;
    }
    if (found?.live.found) {
      return `The ${found.title} is sold out right now. Want me to find you a similar option?`;
    }
    if (found) {
      return `Let me double-check availability on the ${found.title} and a teammate will confirm shortly.`;
    }
    return `Happy to check — which product (and size/color) did you have in mind?`;
  }

  // 8) Greeting / fallback.
  return `Hey! I'm ${agentName} from ${brandName} — happy to help with sizing, an order, tracking, or anything else. What can I do for you?`;
}

/** Search → first product → first variant → LIVE price/stock. Null if none resolves. */
async function findVariant(message: string, impls: Impls) {
  const hits = await impls.searchCatalog({ query: message, limit: 3 });
  const hit = hits.find((h) => h.sourceType === "catalog" && h.productId);
  if (!hit?.productId) return null;
  const variants = await impls.listVariants({ productId: hit.productId });
  const variant = variants[0];
  if (!variant) return null;
  const live = await impls.getVariantLive({ variantId: variant.variantId });
  return { title: hit.title, variantId: variant.variantId, live };
}
