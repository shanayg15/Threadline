# Changelog

All notable changes to Threadline are documented here. The project is built
milestone-by-milestone toward a usable V1; each milestone is a self-contained,
verified increment.

## M6 — Agent Engine, Core Loop & Eval Harness

The agent that answers a cleared inbound — grounded in the brand's live catalog,
order history, and policies, governed by hard rules enforced in code (not the model).

### Added

- **Agent core** (`src/lib/agent`): a tool layer (`search_catalog`, `list_variants`,
  `get_variant_live`, `get_order_status`, `get_customer_history`, `propose_action`,
  `escalate_to_human`), a brand-grounded system prompt, and a **deterministic critique
  gate** that blocks "I've placed/charged" completion claims, invented promo codes,
  and banned phrases before any reply is sent.
- **Hard invariants in code**: stock/price come from the **live** `get_variant_live`
  read (never RAG); side effects are **PROPOSE-ONLY** (a `pending` action is written,
  nothing is placed/charged — execution is M8); the agent escalates on "talk to a
  person"/frustration; the agentic loop is capped (`stepCountIs(6)`).
- **Model gateway**: the real Claude model via the Vercel AI SDK when `ANTHROPIC_API_KEY`
  is set, else a deterministic **keyless stub** that drives the same tools — so the
  whole engine runs in dev/CI without secrets.
- **Orchestrator** (`Agent.respond`): load → model loop → critique (one rewrite, then
  escalate rather than send bad text) → send as an `isReply` outbound (records model +
  cost; optional Langfuse trace). **Fail-safe** — it never throws; any error escalates
  the thread and is audited. `respondAsync` is the timeout-bounded, fire-and-forget
  entry the inbound webhook calls, so an agent error can never 500 the Twilio webhook.
- **Eval harness** (`evals/`, `pnpm eval`): Promptfoo with **16 golden cases** over
  in-memory fixtures (no DB), asserting guardrail-level properties (live price not RAG,
  propose-only, escalation, policy-from-policy, no invented promo) plus a global
  no-completion-claim/no-code/no-banned-phrase guard. Gates prompt changes; keyless it
  runs the stub (CI smoke), with a key it gates the real prompt.
- Unit + integration tests (Vitest): the critique guard (18) and the orchestrator (6)
  — live-price-not-RAG, propose-only, escalation, no-invented-promo, fail-safe,
  opted-out skip.

## M5 — Channel Layer & Compliance Middleware

The trust-critical milestone: the Twilio SMS/MMS channel, an inbound pipeline, and a
**deterministic** compliance gate in front of everything. The LLM is never involved
in any compliance decision.

### Added

- **Channel interface** + **Twilio adapter**: `send` honors the `SEND_REAL_SMS` hard
  gate (false → mock provider id, no carrier call); `verifySignature` validates the
  X-Twilio-Signature; `parseInbound` normalizes the form-encoded webhook.
- **Deterministic compliance** (`src/lib/compliance`, pure, no DB/LLM): a first-word
  keyword matcher (STOP wins; "STOP please"/"Stop." opt out, "please don't stop"
  doesn't), `evaluateInbound` (opt_out/help/resume/blocked/proceed — "YES" resumes
  ONLY when opted out), and `canSendOutbound` (opt-out absolute → consent → quiet
  hours in the customer's tz via luxon (DST-correct, with a `nextAllowedAt`) → caps;
  inbound replies exempt). **91 tests** including the mandatory matrix.
- **Inbound webhook** (`/api/webhooks/twilio/inbound`): verify (bad → 403) → resolve
  brand by number (fail-closed) + upsert customer → land the message → compliance
  side effects (consent, suppression, consentLog/auditLog, mandated canned replies)
  → agent handoff stub (M6). **Status webhook** maps delivery status by provider id.
- Compliance-gated `sendOutbound` + a gate-bypassing `sendComplianceReply` for the
  mandated STOP/HELP/START confirmations.

### Hardened (post-review)

- **Idempotent inbound webhook** (migration 0006): a partial-unique index on
  `(brand_id, channel_message_id)` plus a MessageSid dedupe short-circuit, and the
  handler now fails safe — an unexpected error returns a logged `200` instead of a
  `500`. A Twilio retry can no longer re-run the decision and send a **second**
  STOP confirmation (proven: replaying a signed STOP yields one inbound, one
  confirmation, one `opt_out` log).
- **Seed routes end-to-end**: the demo brand's `channelConfig.phoneNumber` (+
  `supportContact`) is seeded, so the inbound pipeline resolves a tenant against
  seed data instead of silently dropping every message as "unrouted".
- **Quiet hours fail safe**: a missing/invalid customer timezone falls back to a
  default zone (was failing open, i.e. sendable at any hour).
- **Status callback** resolves the tenant by the issued MessageSid (then falls back
  to `From`), so a rotated Messaging Service pool number no longer drops the update.
- Signed-URL origin is pinned to the trusted `APP_URL` rather than client-controlled
  forwarding headers; a real carrier `send` error persists a `failed` message + audit
  instead of vanishing. Added an outbound gate-bypass integration test and expanded
  the quiet-hours matrix (midnight-crossing window, concrete DST `nextAllowedAt`).

## M4 — Shopify Integration, Sync & Embeddings

The data plane the agent will use (M6): catalog/customer/order sync, webhooks,
pgvector embeddings, and live reads. No agent or messaging yet.

### Added

- **Commerce adapter** (`CommerceProvider`) with a real fetch-based **Shopify**
  GraphQL provider (rate-limit backoff + cursor pagination) and a fixture-backed
  **mock** provider, chosen by credential presence. Credentials resolve from the
  per-brand encrypted `integrations` row or `SHOPIFY_*` env; never logged.
- **Idempotent sync** keyed by Shopify id (partial-unique indexes, migration 0004):
  money in integer cents, `fitNotes` preserved across re-sync, synced customers
  default `consentStatus: unknown` (a phone is not consent), no-phone customers
  skipped. CLIs: `sync-cli`, `embed-cli`.
- **HMAC-verified webhooks** at `/api/webhooks/shopify`: verifies the signature on
  the RAW body before parsing (tamper/unknown shop → 401), dedupes retries by
  webhook id (Redis), and on `orders/fulfilled` records an `order_fulfilled` event
  (and sends nothing). Adds an `events` repo.
- **Embeddings**: `Embedder` interface (OpenAI default, Voyage stub, keyless local),
  `embedBrandKnowledge` (catalog + policy chunks, atomic replace), and a hybrid
  `searchCatalog` (pgvector KNN + keyword ILIKE).
- **Live reads** `getVariantLive` / `getOrderStatus` hit the live source at answer
  time — never the synced snapshot (proven by test). `createCheckoutLink` is a stub (M8).
- Unit tests (Vitest): HMAC, webhook field mapping, local embedder.

### Hardened (post-review)

- `order_fulfilled` events are idempotent at the DB (dedupe-key column +
  partial-unique index, migration 0005) — retries and the orders/fulfilled +
  fulfillments/update double-topic yield exactly one event.
- `fulfillments/update` is handled with the correct fulfillment shape (`order_id`);
  webhook tenant resolution fails closed on an ambiguous shop domain; HMAC compares
  decoded base64 bytes; Redis dedupe key is brand-namespaced.

## M3 — Auth & Dashboard Shell

The console becomes reachable and secure: login/signup, brand-scoped sessions, the
six-section shell, and routable placeholder pages.

### Added

- **Auth.js v5** with a Credentials provider verifying email/password against
  `users.passwordHash` (same bcryptjs hasher as the seed), JWT sessions carrying
  `userId`/`brandId`/`role`. Split edge-safe config so middleware validates the JWT
  without Node deps.
- **`getActiveBrand()`** — the sole server-side source of `brandId`; the client
  never supplies it. **Middleware** protects `(dashboard)` + `/onboarding` and
  leaves `/api/*` (webhooks, health, auth) and marketing/login/signup public.
- **Login + signup** pages (server actions): signup creates a brand with a unique
  slug + an owner, handles duplicate email, signs in, and routes to onboarding.
- **Console shell** — left nav rail (six sections, filled active pill, mobile
  Sheet), top bar (`/ {Brand}` breadcrumb, avatar dropdown + logout, "DEV — SMS
  mocked" badge), brand-scoped `(dashboard)/layout.tsx`.
- **Shared UI primitives** — `PageHeader`, `EmptyState`, `StatusBadge`,
  `DataTable` — and routable placeholder pages for all six sections + onboarding.
- Adds a `users` repo (`getByEmail` is the auth bootstrap; the rest stay
  brandId-first).

### Hardened (post-review)

- Signup creates brand + owner in one transaction with a unique-violation guard
  (no orphan brand, no 500 on a concurrent same-email signup).
- `callbackUrl` threaded through login as a validated same-origin path; constant-
  time auth (dummy-hash compare for unknown emails); shared `isUniqueViolation()`
  that also inspects the wrapped Drizzle `.cause`.

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
