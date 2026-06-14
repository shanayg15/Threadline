# Threadline

**An open-source, SMS-first post-purchase concierge for Shopify DTC brands.**

Threadline runs one persistent text thread per customer, powered by an AI agent
grounded in your live Shopify catalog, policies, and order history. It answers fit
and policy questions before checkout, then follows up after delivery to turn
returns into exchanges and one-time buyers into regulars — with deterministic
compliance, human handoff, and honest lift-vs-holdout measurement.

> Open source (MIT). This project clones an **idea, not a brand** — all names,
> copy, and UI are original.

## Status

Built milestone-by-milestone toward a usable V1. **M1–M7 are complete** (foundation;
data model & database; auth & dashboard shell; Shopify sync & embeddings; channel
layer & compliance middleware; agent engine, core loop & eval harness; the operating
console — Conversations, handoff, read pages, onboarding & settings); M8 (lifecycle
engine, confirmation-gate execution & attribution) is next. See [`CLAUDE.md`](./CLAUDE.md)
for the architecture, conventions, and the hard safety invariants every milestone must obey.

**The console.** A three-pane **Conversations** surface — a filterable inbox, an
iMessage-style thread (saturated outbound bubbles with the real **delivery** status —
never a fake "read" receipt), and live polling — with human handoff (AI⇄Human, Pause,
Resolve), a compliance-gated composer (a human can't text an opted-out number either),
and a supervised-mode **Approve / Edit / Reject** bar on held agent drafts. Plus
Customers, Orders, Products (with `fitNotes` editing that re-embeds), a 6-tab Settings,
and a guided onboarding wizard — all brand-scoped from the session.

**Keyless dev:** without Shopify/OpenAI/Anthropic/Twilio credentials, the app falls
back to a fixture-backed mock commerce provider, a deterministic local embedder
(`EMBEDDINGS_PROVIDER=local`), a mocked SMS send (`SEND_REAL_SMS=false` — the
default), and a **deterministic stub agent**, so the whole pipeline — inbound →
compliance → agent → reply — runs end-to-end. Compliance (STOP/HELP/START, quiet
hours, consent, frequency caps) is **deterministic TypeScript, never the LLM**, with
an exhaustive test suite. Set the real `SHOPIFY_*` / `OPENAI_API_KEY` /
`ANTHROPIC_API_KEY` / `TWILIO_*` (+ `SEND_REAL_SMS=true`) to use the live integrations
and the real Claude agent.

```bash
pnpm tsx src/lib/commerce/sync-cli.ts <brandId>     # sync catalog/customers/orders
pnpm tsx src/lib/embeddings/embed-cli.ts <brandId>  # build the pgvector knowledge base
pnpm eval                                           # run the agent guardrail evals
```

> **The agent.** On a cleared inbound, a grounded agent answers in the brand's voice:
> stock/price come from **live** Shopify tool calls (never RAG), policy answers come
> only from the brand's policies, and side effects (place order / exchange / checkout
> link) are **propose-only** — a pending action is created and the customer is asked
> to confirm; nothing is placed or charged (execution is a later milestone). It
> escalates to a human on "talk to a person", confusion, or low confidence, and a
> deterministic **critique gate** blocks any "I've placed/charged" claim or invented
> promo before a reply is sent. The agent is fail-safe and runs off the webhook
> asynchronously, so a model error can never break inbound handling.

## Tech stack

Next.js 16 (App Router, TypeScript strict) · Postgres 16 + pgvector · Drizzle ORM ·
Redis + BullMQ · Auth.js v5 · Tailwind CSS + shadcn/ui · Vercel AI SDK + Anthropic
(Claude) · Twilio (SMS/MMS) · Promptfoo (evals) · Langfuse (tracing).

A single Next.js app serves the dashboard, API, and webhooks; a separate worker
process runs background jobs. External services sit behind swappable adapters.

## Brand

Threadline uses its own visual identity, deliberately distinct from the reference
product:

- **Primary color:** Threadline Coral `#E8623A` (warm terracotta), over warm-stone
  neutrals — not a cool slate.
- **Typeface:** [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans)
  for UI, [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) for code.

Tokens live in [`src/app/globals.css`](./src/app/globals.css) and
[`tailwind.config.ts`](./tailwind.config.ts) (light + dark).

**Console shell:** a persistent 240px left nav rail (icon + label, with a filled
coral active pill) that collapses into a Sheet on mobile, and a 64px top bar with a
`/ {Brand}` breadcrumb, an avatar dropdown, and a "DEV — SMS mocked" badge. Content
sits in a max-width 6xl container with a consistent `PageHeader` per page. Type
scale: page titles `text-2xl` semibold, body `text-sm`; spacing on a 4px grid
(`gap`/`p` multiples of 4); rounded-`lg`/`xl` surfaces matching the `0.65rem` token
radius.

## Prerequisites

- **Node 20+**, **pnpm 9+**
- **Docker + Docker Compose**

## Quick start

```bash
# 1. Start Postgres (pgvector) + Redis
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
#    Generate secrets and paste them into .env:
#      openssl rand -base64 32   # -> AUTH_SECRET
#      openssl rand -base64 32   # -> ENCRYPTION_KEY (must decode to 32 bytes)
#    For local M1/M2 you only need DATABASE_URL, REDIS_URL, AUTH_SECRET, ENCRYPTION_KEY.

# 4. Create the schema (runs the pgvector extension migration first) and seed
#    a demo brand with catalog, customers and orders.
pnpm db:migrate
pnpm db:seed

# 5. Run the app and (in another shell) the worker
pnpm dev
pnpm worker
```

> The schema is provisioned via `pnpm db:migrate` because the first migration
> enables the pgvector extension, which a bare `db:push` cannot do on a fresh
> database. Once migrated, `pnpm db:push` is fine for quick iteration.

Then open <http://localhost:3000>. Check service health at
<http://localhost:3000/api/health> — it returns `200` only when both Postgres and
Redis answer, `503` otherwise.

> **Local port note:** `docker-compose.yml` maps Postgres to host port **5434**
> (not the default 5432) so it can coexist with other local Postgres instances. The
> `DATABASE_URL` in `.env.example` already points at `5434`; change both together if
> you remap it. Redis uses `6379`.

## Scripts

| Script                              | Description                          |
| ----------------------------------- | ------------------------------------ |
| `pnpm dev`                          | Run the Next.js app (dev)            |
| `pnpm build` / `pnpm start`         | Production build / serve             |
| `pnpm worker`                       | Run the background worker            |
| `pnpm db:generate`                  | Generate Drizzle migrations (M2+)    |
| `pnpm db:migrate` / `pnpm db:push`  | Apply migrations / push schema (M2+) |
| `pnpm db:seed`                      | Seed the demo brand fixture (M2+)    |
| `pnpm test` / `pnpm test:watch`     | Run Vitest                           |
| `pnpm eval`                         | Run the agent guardrail evals (M6)   |
| `pnpm lint` / `pnpm typecheck`      | ESLint / `tsc --noEmit`              |
| `pnpm format` / `pnpm format:check` | Prettier write / check               |

## Project structure

```
src/
  app/
    (marketing)/        # public landing (this milestone)
    (dashboard)/        # authed console — M3/M7
    onboarding/         # onboarding flow — M7
    login/  signup/     # auth pages — M3
    api/health/         # readiness probe
  lib/
    config/env.ts       # zod-validated, typed env loader
    db/                 # Drizzle client (schema + repos in M2)
    auth commerce embeddings channels compliance agent tracking jobs slack
  components/ui/        # shadcn/ui primitives
  types/
worker/                 # background worker entry (BullMQ in M8)
evals/                  # Promptfoo cases (M6)
drizzle/                # generated migrations (M2)
docker-compose.yml      # Postgres + pgvector, Redis
```

## License

[MIT](./LICENSE) © 2026 Shanay Gaitonde
