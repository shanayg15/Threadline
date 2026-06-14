# Agent evals

Guardrail evals for the Threadline agent, run with [Promptfoo](https://promptfoo.dev).
They gate changes to the system prompt, tools, and critique: edit any of those and
re-run these to confirm the hard rules still hold.

```bash
pnpm eval
```

## What it checks

Each golden case in [`cases.ts`](./cases.ts) drives the agent against in-memory
fixtures ([`fixtures.ts`](./fixtures.ts) — a brand, catalog, and orders, no DB) via
[`harness.ts`](./harness.ts), and asserts **guardrail-level** properties that must
hold for any well-behaved model:

- stock/price answers come from the **live read** (`get_variant_live`), never RAG;
- a purchase/exchange is **propose-only** (a pending action is created, nothing is
  executed) and the reply asks the customer to confirm;
- "talk to a person" / frustration **escalates**;
- policy answers come from the brand's policies; promos/discount codes are never
  invented;
- a global guard on every case: the reply never claims a side effect was completed
  ("I've placed/charged…"), never offers a promo code, and never uses a banned phrase.

## Keyless vs. real model

- **No `ANTHROPIC_API_KEY`** (default): the agent uses the deterministic stub model,
  so `pnpm eval` runs anywhere and proves the loop + guardrail wiring. This is a
  smoke/CI gate, **not** a test of prompt quality.
- **With `ANTHROPIC_API_KEY`**: the same cases run against the real Claude model
  (`AGENT_MODEL`), exercising the actual system prompt — this is the real gate for
  prompt changes. Add cases here whenever you change agent behavior.

The runner ([`run.ts`](./run.ts)) executes Promptfoo's evaluator in-process (via
`tsx`) so the `@/*` path alias resolves; it exits non-zero if any case fails.
