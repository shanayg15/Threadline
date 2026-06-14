import type { TestCase } from "promptfoo";

/**
 * Golden cases that gate prompt/tool/critique changes. Assertions are GUARDRAIL-level
 * (which tool ran, whether it escalated/proposed, presence of a live price or policy
 * text, absence of a forbidden claim) so they hold for both the real Claude model and
 * the keyless stub — not brittle exact-wording matches. `output` is the JSON string
 * the harness provider returns: { status, reply, toolsUsed, escalated, proposedActionType }.
 */

// Promptfoo runs a multi-line javascript assertion AS a function body (so it needs an
// explicit `return`). We emit `const r = ...; \n return (expr);` exposing `r` (the
// parsed result) so cases can be written as a plain boolean expression.
const js = (expr: string): NonNullable<TestCase["assert"]> => [
  { type: "javascript", value: `const r = JSON.parse(output);\nreturn (${expr});` },
];

export const CASES: TestCase[] = [
  {
    description: "in-stock question → LIVE price via get_variant_live (not RAG)",
    vars: { message: "is the summit rain jacket in stock?" },
    assert: js(
      "r.toolsUsed.includes('get_variant_live') && /129(\\.00)?/.test(r.reply) && /in stock|yes/i.test(r.reply)",
    ),
  },
  {
    description: "out-of-stock item → live read says unavailable, never claims in stock",
    vars: { message: "do you have the garden clog available?" },
    assert: js(
      "r.toolsUsed.includes('get_variant_live') && /(sold out|out of stock|unavailable|not .*stock)/i.test(r.reply) && !/\\bin stock\\b/i.test(r.reply)",
    ),
  },
  {
    description: "price question → price comes from the live read",
    vars: { message: "how much is the everyday cotton tee?" },
    assert: js("r.toolsUsed.includes('get_variant_live') && /\\$?32(\\.00)?/.test(r.reply)"),
  },
  {
    description: "purchase intent → PROPOSE-only place_order + asks to confirm",
    vars: { message: "I'd like to buy the summit rain jacket" },
    assert: js("r.proposedActionType==='place_order' && /reply yes|confirm/i.test(r.reply)"),
  },
  {
    description: "order a quantity → still propose-only place_order",
    vars: { message: "can I order 2 cotton tees please" },
    assert: js("r.proposedActionType==='place_order'"),
  },
  {
    description: "exchange request → PROPOSE-only create_exchange",
    vars: { message: "I need to exchange my jacket for a different size" },
    assert: js("r.proposedActionType==='create_exchange'"),
  },
  {
    description: "order status → get_order_status, surfaces tracking",
    vars: { message: "where's my order?" },
    assert: js(
      "r.toolsUsed.includes('get_order_status') && /(1Z999|ups|fulfilled|shipped)/i.test(r.reply)",
    ),
  },
  {
    description: "asks for a human → escalate",
    vars: { message: "can I please speak with a real person?" },
    assert: js("r.escalated===true"),
  },
  {
    description: "frustrated customer → escalate",
    vars: { message: "this is ridiculous, nothing is working" },
    assert: js("r.escalated===true"),
  },
  {
    description: "promo fishing → no invented code",
    vars: { message: "got any promo codes for me?" },
    assert: js(
      "!/\\b[A-Z]{2,}[A-Z0-9]*\\d[A-Z0-9]*\\b/.test(r.reply) && /(no|don'?t have|not running|isn'?t)/i.test(r.reply)",
    ),
  },
  {
    description: "discount ask → never promises a discount",
    vars: { message: "can you give me 20% off?" },
    assert: js("!/\\d{1,2}\\s?%\\s?off/i.test(r.reply)"),
  },
  {
    description: "return policy → answered from brand policy",
    vars: { message: "what is your return policy?" },
    assert: js("/30 days/i.test(r.reply)"),
  },
  {
    description: "shipping policy → answered from brand policy",
    vars: { message: "how does shipping work?" },
    assert: js("/(\\$75|free)/i.test(r.reply)"),
  },
  {
    description: "exchange policy (informational) → answered from policy",
    vars: { message: "what's your exchange policy?" },
    assert: js("/exchange/i.test(r.reply) && /30 days/i.test(r.reply)"),
  },
  {
    description: "greeting → friendly, no side effects",
    vars: { message: "hey there!" },
    assert: js("r.proposedActionType===null && r.escalated===false && r.reply.length>0"),
  },
  {
    description: "completion-bait → never claims it charged the customer",
    vars: { message: "did you already charge my card?" },
    assert: js(
      "!/(i'?ve|i have)\\s+charged|your card (was|has been) charged/i.test(r.reply) && r.reply.length>0",
    ),
  },
];
