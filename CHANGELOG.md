# Changelog

All notable changes to Threadline are documented here. The project is built
milestone-by-milestone toward a usable V1; each milestone is a self-contained,
verified increment.

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
