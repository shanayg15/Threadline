<div align="center">

# Threadline

### SMS-first post-purchase concierge for Shopify DTC brands

Run one persistent text thread per customer, grounded in your live Shopify catalog, policies, and order history. An AI agent answers fit and policy questions, then follows up after delivery to turn returns into exchanges and one-time buyers into regulars — with deterministic compliance, human handoff, and honest lift-vs-holdout measurement built in.

<br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-E8623A?style=for-the-badge)](LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Postgres + pgvector](https://img.shields.io/badge/Postgres-pgvector-1F2937?style=for-the-badge&logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)

[![runs with zero API keys](https://img.shields.io/badge/runs_with-zero_API_keys-E8623A?style=for-the-badge)](#quickstart)
[![compliance deterministic](https://img.shields.io/badge/compliance-deterministic-1F2937?style=for-the-badge)](#how-it-works)
[![guardrail evals](https://img.shields.io/badge/guardrails-Promptfoo-7C5C3E?style=for-the-badge)](#verification)
[![self-hostable](https://img.shields.io/badge/self--hostable-yes-4B5563?style=for-the-badge)](#going-live)

<br/>

[Quickstart](#quickstart) · [How it works](#how-it-works) · [Verification](#verification) · [Going live](#going-live) · [Documentation](#documentation)

</div>

---

DTC brands blast one-way broadcast SMS that customers tune out, mark as spam, and unsubscribe from. The post-purchase moment — the days between "order placed" and "is this the right size?" — is where exchanges, reorders, and saved customers actually live, and a broadcast can't hold a conversation. Threadline replaces the blast with one ongoing thread per customer, handled by an agent grounded in your real store. The model is roughly five percent of the work. Grounding, compliance, and honest measurement are the product. This clones an **idea, not a brand** — all names, copy, and UI are original.

## What it does

- **Holds one thread per customer.** A single persistent two-way SMS/MMS conversation, in the brand's voice, that answers pre-purchase questions and proactively follows up after delivery — no broadcast, no one-off campaigns.
- **Stays grounded in your live store.** Stock and price come from **live Shopify tool calls at answer time**, never from a snapshot or RAG. Policy answers come only from the brand's own policies. The agent never invents promo codes, discounts, or promises.
- **Never acts without a yes.** Side effects (place order, exchange, checkout link) are **propose-only**: the agent creates a pending action and asks the customer to confirm. On an unambiguous "yes" the confirmation gate executes it via a customer-paid Shopify checkout link — **never** a card-on-file charge. "Yes but in navy" re-proposes; "maybe" asks to clarify.
- **Keeps compliance out of the model's hands.** STOP/HELP/START, quiet hours, consent, and frequency caps are **deterministic TypeScript decided before the LLM is ever called** — with an exhaustive test suite. A human composer is gated by the same rules: you can't text an opted-out number either.
- **Hands off to humans cleanly.** A three-pane console with AI⇄Human handoff, Pause/Resolve, and a supervised **Approve / Edit / Reject** bar on held agent drafts, with real SMS **delivery** status (never a fake "read" receipt).
- **Measures honestly.** A proactive post-delivery check-in goes only to opted-in **treatment** customers; the **control** group is a true holdout and is never messaged (enforced at scheduling *and* at send). Orders are attributed back to the conversation that drove them, feeding an assist-based Analytics page with treatment/holdout counts.
- **Multi-tenant from the first row.** Every domain row carries a `brand_id`; every query is brand-scoped from the session. Integration credentials are encrypted at rest; audit and consent logs are append-only.

## Quickstart

Threadline runs **with zero API keys**. Without Shopify, Anthropic, OpenAI, or Twilio credentials it falls back to a fixture-backed mock commerce provider, a deterministic local embedder, mocked SMS sends, and a deterministic stub agent — so the whole pipeline (inbound → compliance → agent → reply, plus the proactive lifecycle) runs end-to-end on a fresh clone.

Prerequisites: [Node 20+](https://nodejs.org), [pnpm 9+](https://pnpm.io), and Docker (for Postgres + Redis).

```bash
git clone https://github.com/shanayg15/Threadline.git && cd Threadline
pnpm install

docker compose up -d        # Postgres 16 + pgvector and Redis
cp .env.example .env        # see below — only 4 vars needed to start

pnpm db:migrate             # enables pgvector, then creates the schema
pnpm db:seed                # a demo brand with catalog, customers, and orders

pnpm dev                    # app at http://localhost:3000
pnpm worker                 # (in a second shell) the lifecycle worker
```

For a local keyless run you only need four values in `.env` — `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`, and `ENCRYPTION_KEY`:

```bash
openssl rand -base64 32     # -> AUTH_SECRET
openssl rand -base64 32     # -> ENCRYPTION_KEY (must decode to 32 bytes)
```

What you will see:

- `pnpm dev` serves the full console on the seeded brand — Conversations, Customers, Orders, Products, Analytics, and Settings, plus the public marketing site.
- `pnpm worker` runs the BullMQ lifecycle: a delivered order schedules a treatment-only, quiet-hours-respecting check-in.
- `pnpm eval` runs the agent guardrail evals; `pnpm test` runs the Vitest suite (compliance, channels, agent gate, attribution).

Service health is at <http://localhost:3000/api/health> — it returns `200` only when both Postgres and Redis answer, `503` otherwise.

> **Local port note:** `docker-compose.yml` maps Postgres to host port **5434** (not the default 5432) so it can coexist with other local Postgres instances. The `DATABASE_URL` in `.env.example` already points at `5434`; change both together if you remap it. Redis uses `6379`. The first schema setup uses `pnpm db:migrate` (not `db:push`) because the first migration enables the pgvector extension; once migrated, `pnpm db:push` is fine for quick iteration.

## Bring your own keys

To use the real integrations and the real Claude agent, connect services and flip a couple of env values. Shopify and Twilio credentials are entered in **Settings → Integrations** and stored encrypted at rest (AES-256-GCM); model and embedding keys live in `.env`.

| What it turns on | How |
|---|---|
| **Real Claude agent** | set `ANTHROPIC_API_KEY` and pick `AGENT_MODEL` (Opus, Sonnet, or Haiku). Without it, the deterministic stub agent runs. |
| **Real embeddings** | set `EMBEDDINGS_PROVIDER=openai` (or `voyage`) and the matching key. `local` is a deterministic offline default. |
| **Live Shopify catalog** | add the store credentials in Settings → Integrations, then sync (below). |
| **Real outbound SMS** | add Twilio credentials and set `SEND_REAL_SMS=true` — a hard gate that defaults `false`, so nothing leaves your machine until you opt in against a verified number. |

```bash
pnpm tsx src/lib/commerce/sync-cli.ts <brandId>     # sync catalog, customers, orders
pnpm tsx src/lib/embeddings/embed-cli.ts <brandId>  # build the pgvector knowledge base
```

## Going live

The full environment template is `.env.example`. The variables that matter most:

| Variable | Purpose | Where to get it |
|---|---|---|
| `DATABASE_URL` / `REDIS_URL` | Postgres + pgvector and Redis | Docker Compose (provided) |
| `AUTH_SECRET` / `ENCRYPTION_KEY` | session signing and credential encryption | `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` + `AGENT_MODEL` | Claude for the agent | [console.anthropic.com](https://console.anthropic.com) |
| `OPENAI_API_KEY` | embeddings (when `EMBEDDINGS_PROVIDER=openai`) | [platform.openai.com](https://platform.openai.com) |
| `TWILIO_*` + `SEND_REAL_SMS` | live SMS/MMS send and receive | [twilio.com](https://www.twilio.com) |
| `SHOPIFY_*` | store catalog, orders, and webhooks | a Shopify custom app |
| `SLACK_WEBHOOK_URL` | escalation notifications | optional |
| `LANGFUSE_*` | agent tracing | optional |

**Verify the live paths** once keys are in place:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm eval
```

**Approval gate.** Outbound proactive messages are gated on consent, quiet hours, frequency caps, and experiment group, and held drafts wait for a human Approve/Edit/Reject in supervised mode. The control group is a true holdout and is never messaged. There is no auto-charge and no blast, by design.

## How it works

```
            Customer  ⇄  one persistent SMS / MMS thread  ⇄  Threadline

   INBOUND (reactive)                         OUTBOUND (proactive)
   ──────────────────                         ────────────────────
   Twilio webhook                             Shopify / tracking webhook
        │                                          │  order delivered
        v                                          v
   Compliance middleware                      Event → BullMQ queue → scheduler
   STOP/HELP/START · quiet hours               picks a declarative playbook
   consent · frequency caps                         │
   (deterministic TS, never the LLM)          gate: consent · quiet hours ·
        │  cleared                            frequency cap · experiment group
        v                                      treatment only — control = true holdout
   Agent engine                                     │
   live Shopify tools + RAG + critique        composer → (supervised approval)
        │                                            │
        └─────────────────┬──────────────────────────┘
                          v
            Pending-action confirmation gate
   unambiguous "yes" → customer-paid Shopify checkout link (never a card charge)
                          │
                          v
   Reply sent · every send & execution audited (append-only) · order attributed → Analytics
```

The safety layer is the product, built from the first commit, and enforced in code rather than trusted to the model:

1. **Compliance is deterministic code, never the LLM** — decided in middleware before the model is called.
2. **Stock and price are always live Shopify calls at answer time**, never from RAG or a snapshot.
3. **No card-on-file charging.** Money flows through customer-paid Shopify checkout links, behind the pending-action gate's explicit in-thread "yes".
4. **`SEND_REAL_SMS` defaults `false`** — outbound is mocked and logged in dev until you explicitly enable it.
5. **Evals gate prompt changes** — guardrail cases run on every agent or prompt edit.
6. **Multi-tenant from the start** — every row carries `brand_id`; `brandId` is the first argument of every repository function.
7. **Open-source hygiene** — no hardcoded secrets, credentials encrypted at rest, money stored in integer cents, audit and consent logs append-only.

A deterministic **critique gate** is the last line: it blocks any "I've placed/charged…" claim or invented promo before a reply is ever sent, and the agent runs off the webhook asynchronously so a model error can never break inbound handling.

## Verification

You cannot prove a conversational agent is well-behaved by reading the prompt, so the guardrail evals are the evidence. Each golden case in [`evals/cases.ts`](evals/cases.ts) drives the agent against in-memory fixtures (a brand, catalog, and orders — no DB) and asserts properties that must hold for *any* model:

```text
$ pnpm eval
  ✓ stock/price answers come from the live read (get_variant_live), never RAG
  ✓ purchase/exchange is propose-only — a pending action, nothing executed
  ✓ "talk to a person" / frustration escalates to a human
  ✓ policy answers come from brand policies; promos are never invented
  ✓ global guard: no "I've placed/charged" claim, no promo code, no banned phrase
```

By default (no `ANTHROPIC_API_KEY`) the evals run against the deterministic stub model, so the loop and guardrail wiring are proven anywhere — a CI smoke gate. With a key, the same cases run against the real Claude model, exercising the actual system prompt; that is the real gate for prompt changes. `pnpm test` runs the Vitest suite covering deterministic compliance, the channel layer, the confirmation gate, and attribution.

## Stack

| Concern | Choice |
|---|---|
| App, API, dashboard, webhooks | Next.js 16 (App Router), React 19 |
| Worker | a separate Node process, BullMQ on Redis |
| Language | TypeScript, strict + `noUncheckedIndexedAccess`. One language, one deploy |
| Database | Postgres 16 + pgvector, Drizzle ORM and migrations |
| Auth | Auth.js v5 (next-auth), brand-scoped sessions |
| LLM | Claude via the Vercel AI SDK, behind a swappable model interface with a deterministic stub |
| Embeddings | swappable `Embedder`: OpenAI (default), Voyage, or a local deterministic embedder |
| SMS / MMS | Twilio behind a channel adapter (mocked in dev) |
| Commerce | Shopify Admin API behind a commerce adapter (fixture-backed mock in dev) |
| Tracking | heuristic (default) or EasyPost |
| UI | Tailwind CSS + shadcn/ui (Radix primitives) |
| Evals | Promptfoo guardrail cases |
| Tracing | Langfuse (optional) |
| Validation | Zod, which also constrains the LLM JSON output |

The only non-open-source pieces — the model, embeddings, SMS, and commerce — sit behind interfaces with local fallbacks, so a fully keyless run is real rather than a footnote.

## Repo layout

```
drizzle/          generated SQL migrations (pgvector enabled first)
evals/            Promptfoo guardrail cases, fixtures, harness, runner
worker/           background worker entry (BullMQ lifecycle scheduler)
src/app/
  (marketing)/    public landing site (kept out of the auth middleware)
  (dashboard)/    the console — Conversations, Customers, Orders, Products, Analytics, Settings
  onboarding/     guided setup wizard
  api/            health probe, Twilio + Shopify webhooks, conversations
src/lib/
  agent/          grounded agent — model, tools, prompt, critique, confirmation gate
  compliance/     deterministic STOP/HELP/START, quiet hours, consent, frequency caps
  commerce/       Shopify adapter + fixture-backed mock, catalog/order sync
  channels/       Twilio SMS/MMS adapter and outbound send
  embeddings/     pgvector knowledge base (OpenAI · Voyage · local)
  measure/        experiment groups + assist-based attribution
  jobs/           BullMQ queues, lifecycle and proactive scheduling
  db/             Drizzle schema, brand-scoped repositories, seed
src/components/    shadcn/ui primitives plus console and marketing components
```

## Documentation

[`CLAUDE.md`](CLAUDE.md) is the source of truth — the architecture, the locked stack, the hard safety invariants, and the milestone history (M1–M9, complete). See also the [evals guide](evals/README.md), the [`CHANGELOG`](CHANGELOG.md), and the markdown blog under [`src/content/blog`](src/content/blog).

## Contributing

Issues and pull requests are welcome. House rules: obey the hard safety invariants in [`CLAUDE.md`](CLAUDE.md) (compliance stays deterministic, stock/price stay live, side effects stay propose-only, no card charging); `pnpm typecheck && pnpm lint && pnpm test && pnpm eval` must pass; keep every query brand-scoped; store money in integer cents; and never commit secrets.

---

<div align="center">

**Threadline** — open source under the [MIT License](LICENSE).

© 2026 Shanay Gaitonde, Sahiel Bose

</div>
