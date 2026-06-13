# Changelog

All notable changes to Threadline are documented here. The project is built
milestone-by-milestone toward a usable V1; each milestone is a self-contained,
verified increment.

## M2 — Data Model & Database Layer

The full relational + vector schema, migrations, dev seed, and a brand-scoped
repository layer. No app features consume it yet, but every later milestone does.

### Added

- **AES-256-GCM crypto** (`src/lib/db/crypto.ts`) for integration credentials at
  rest — `iv:authTag:ciphertext`, tamper-evident.
- **Drizzle schema** — 17 tables split by domain with 19 enum types, typed jsonb
  blobs, and relations. Multi-tenant: `brandId` on every domain table. Money in
  integer cents; `vector(EMBEDDING_DIM)` embedding with an HNSW cosine index;
  unique `(brandId, phoneE164)`; partial-unique one-open pending action per
  conversation.
- **Migrations** — `0000` enables pgvector (runs first), `0001` creates the schema;
  applied via `drizzle-kit migrate` and verified in-sync.
- **Repository layer** (`src/lib/db/repos`) — thin, typed, brand-scoped data access;
  every function takes `brandId` first. Append-only audit/consent logs.
- **Idempotent seed** — "Demo Apparel Co" with voice/policies, an owner (bcrypt),
  8 products + variants (incl. a sold-out one), 5 opted-in customers, 6 orders, and
  enabled playbooks. No knowledgeChunks (embeddings are M4).

### Hardened (post-review)

- Unique `(brandId, kind)` on integrations with an atomic `onConflict` upsert
  (migration 0002) — no find-then-write race.
- Database-level append-only enforcement: `BEFORE UPDATE OR DELETE` triggers on
  `audit_log`/`consent_log` (migration 0003) — the invariant no longer relies on
  repo convention alone.

## M1 — Foundation & Infrastructure

The empty-but-runnable skeleton everything else builds on. No business logic.

### Added

- **Next.js 16** app (App Router, TypeScript strict + `noUncheckedIndexedAccess`,
  `src/`, `@/*` alias) with ESLint + Prettier.
- **Docker Compose** dev stack: Postgres 16 + pgvector and Redis 7-alpine, both
  with healthchecks (Postgres on host port 5434 to coexist with other local DBs).
- **Typed env loader** (`src/lib/config/env.ts`): zod-validated, frozen, parsed
  once, with a single aggregated error naming every missing/invalid key. Encodes
  real invariants (32-byte AES-256 `ENCRYPTION_KEY`, explicit boolean parsing,
  `EMBEDDING_DIM` integer, `SEND_REAL_SMS` sender cross-check).
- **Drizzle** client singleton + `drizzle-kit` config (schema lands in M2).
- **Background worker** stub: Redis connectivity, "worker up", graceful shutdown.
- **`GET /api/health`** readiness probe — Postgres + Redis with fail-fast timeouts,
  `200` when both answer, `503` otherwise.
- **Design system**: Tailwind v3.4 + shadcn/ui with original Threadline brand tokens
  (Coral `#E8623A`, warm-stone neutrals, Plus Jakarta Sans / JetBrains Mono).
- **Marketing landing** placeholder in our own brand and copy.
- **Open-source hygiene**: MIT `LICENSE`, gitignored `.env`, `.env.example`
  template, `README.md`, and a condensed `CLAUDE.md` build guide.
