# CLAUDE.md — Threadline build guide

Condensed source of truth for anyone (human or agent) working in this repo. Build
the **current milestone only**, obey the **hard safety invariants**, and never
scope-creep into later milestones.

## What this is

Threadline is an open-source, **SMS-first** post-purchase conversational-commerce
concierge for Shopify DTC brands. An AI agent — grounded in a brand's live Shopify
catalog, policies, and order history — runs one persistent two-way text thread per
customer: answering pre-purchase questions and proactively following up after
delivery to drive exchanges, cross-sells, reorders, and saves, with deterministic
compliance, human handoff, and honest measurement.

This clones an **idea, not a brand**. All names, copy, and UI are original.

## Architecture (one screen)

- **One Next.js app** (App Router, dashboard UI + API routes + webhooks) **+ a
  separate worker process** (BullMQ, lifecycle scheduler). Modular `src/lib/<domain>`
  layout — this supersedes any multi-`packages/` sketch in the planning docs.
- Inbound flow: Twilio webhook → **deterministic compliance middleware**
  (STOP/HELP/START/quiet-hours/consent) → conversation service → agent engine
  (LLM + live Shopify tools + RAG + critique) → reply. Side-effects go through a
  **pending-action confirmation gate**.
- Outbound flow: Shopify/tracking webhook → event → queue → scheduler picks a
  declarative **playbook** → gated on consent + quiet hours + frequency cap +
  experiment group → composer → (supervised approval) → send.
- Data: **Postgres 16 + pgvector** (relational + embeddings), Drizzle ORM.

## Stack (locked)

Next.js (TS strict) · Postgres 16 + pgvector · Drizzle ORM · Redis + BullMQ ·
Auth.js v5 · Tailwind + shadcn/ui · Vercel AI SDK + Anthropic (Claude) · Twilio
(SMS/MMS) · Promptfoo (evals) · Langfuse (tracing). All direct dependencies are
permissively licensed (MIT/ISC/Apache-2.0/BSD); external services sit behind
swappable adapters.

## Hard safety invariants (never violated)

1. **Compliance is deterministic code, never the LLM.** STOP/HELP/START/
   quiet-hours/consent are decided in middleware _before_ the model is called.
2. **Stock & price are always live Shopify calls at answer time**, never from
   RAG/snapshots (`inventory_qty` is a display-only snapshot).
3. **No card-on-file charging in V1.** Money flows via Shopify checkout links /
   draft-order invoices the customer pays. Side-effects go through the
   pending-action gate requiring an explicit in-thread "yes".
4. **`SEND_REAL_SMS` env gate** defaults `false`; outbound is mocked/logged in dev
   until explicitly enabled against a verified test number.
5. **Evals gate prompt changes** — Promptfoo cases run (and extend) on every
   agent/prompt edit.
6. **Multi-tenant from the start** — every domain row carries `brand_id`; every
   query is brand-scoped (`brandId` is the first argument of every repo function).
7. **Open-source hygiene** — MIT, no hardcoded secrets (env only), integration
   credentials encrypted at rest (AES-256-GCM), money stored in integer **cents**,
   audit/consent logs are **append-only**.

## Milestones

V1 is built milestone-by-milestone; do not start a later one until the previous
one's Definition of Done is met and verified.

1. **Foundation & infrastructure** — repo, Docker, Next.js skeleton, env, health. ✅
2. **Data model & database** — Drizzle schema, migrations, pgvector, seed, repos. ✅
3. **Auth & dashboard shell** — Auth.js v5, brand-scoped sessions, console shell. ✅
4. **Shopify integration, sync & embeddings** — commerce adapter, sync, webhooks,
   pgvector embeddings, live reads. ✅
5. **Channel layer & compliance middleware** — Twilio adapter, inbound pipeline,
   deterministic STOP/HELP/START + quiet-hours/consent/caps. ✅
6. **Agent engine, core loop & eval harness** — grounded agent (live Shopify tools +
   RAG + propose-only side effects + critique + escalation), wired into the inbound
   webhook (fail-safe, async), Promptfoo evals. Keyless via a deterministic stub. ✅
7. Console UI, handoff, read pages & onboarding
8. Lifecycle engine, confirmation gates & attribution
9. Marketing / landing site

## Out of scope (by design)

**OpenSwarm.** Do not design for it, add abstractions/hooks for it, or hold open
seams for it. A clean, modular, MIT-licensed standalone app is the goal. Treat any
OpenSwarm integration as a much-later phase that does not exist today.

## Conventions

- TypeScript strict + `noUncheckedIndexedAccess`. Lint + format clean before commit.
- `@/*` → `src/*` (Next + tsx resolve it; drizzle-kit does **not** — use relative
  imports in `drizzle.config.ts` and schema files).
- Read the milestone spec for the milestone you are on before writing code, and
  obey its "Do NOT do in this milestone" section strictly.
