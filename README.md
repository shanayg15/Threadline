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

Built milestone-by-milestone toward a usable V1. **M1 (foundation & infrastructure)
is complete**; M2 (data model & database) is next. See [`CLAUDE.md`](./CLAUDE.md)
for the architecture, conventions, and the hard safety invariants every milestone
must obey.

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

# 4. (After M2) create the schema
# pnpm db:push

# 5. Run the app and (in another shell) the worker
pnpm dev
pnpm worker
```

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
| `pnpm lint` / `pnpm typecheck`      | ESLint / `tsc --noEmit`              |
| `pnpm format` / `pnpm format:check` | Prettier write / check               |

## Project structure

```
src/
  app/                  # Next.js App Router: marketing, console (M3/M7), api/health
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
