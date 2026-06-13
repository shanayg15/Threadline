import { config as loadDotenv } from "dotenv";
import { z } from "zod";

/**
 * Typed, validated environment configuration.
 *
 * `process.env` is parsed exactly once, at import time. All field-level errors are
 * aggregated into a single throw naming every offending key, so misconfiguration
 * fails fast and loud instead of surfacing as a confusing runtime error deep in a
 * request. (Cross-field/production checks in the superRefine below run only once the
 * base shape is valid, so a config with both shape and cross-field problems is fixed
 * in at most two passes.)
 *
 * Server-only: this reads secrets from `process.env` and must never be imported
 * into a client component or exposed via `NEXT_PUBLIC_*`.
 */

// Load `.env` for non-Next runtimes (the BullMQ worker, drizzle-kit, seed
// scripts). Inside the Next.js runtime these are already populated; dotenv does
// not override existing values, so this is a harmless no-op there.
loadDotenv({ quiet: true });

/** Treat empty strings the same as "unset" so `.optional()` and defaults behave. */
const optionalString = z.preprocess(
  (v) => (v === "" || v === undefined ? undefined : v),
  z.string().optional(),
);

/** Parse "true"/"false" (case-sensitive) — NOT z.coerce.boolean(), which treats "false" as true. */
const boolFromEnv = z.preprocess(
  (v) => (v === undefined || v === "" ? "false" : v),
  z.enum(["true", "false"]).transform((v) => v === "true"),
);

/** Positive integer from an env string, falling back to `def` when unset/empty. */
const intFromEnv = (def: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.coerce.number().int().positive().default(def),
  );

const EnvSchema = z
  .object({
    // --- App ---
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    APP_URL: z
      .string()
      .default("http://localhost:3000")
      .refine((v) => /^https?:\/\//.test(v), "APP_URL must start with http:// or https://"),
    AUTH_SECRET: z
      .string()
      .min(
        16,
        "AUTH_SECRET must be at least 16 characters (generate with `openssl rand -base64 32`)",
      ),
    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL is required")
      .refine(
        (v) => /^postgres(ql)?:\/\//.test(v),
        "DATABASE_URL must be a postgres:// connection string",
      ),
    REDIS_URL: z
      .string()
      .min(1, "REDIS_URL is required")
      .refine((v) => /^rediss?:\/\//.test(v), "REDIS_URL must be a redis:// connection string"),

    // --- LLM (Anthropic) — keys optional until the agent ships (M6) ---
    ANTHROPIC_API_KEY: optionalString,
    AGENT_MODEL: z.string().default("claude-sonnet-4-6"),
    CRITIQUE_MODEL: z.string().default("claude-haiku-4-5-20251001"),

    // --- Embeddings (default OpenAI; swappable) — wired in M4 ---
    EMBEDDINGS_PROVIDER: z.enum(["openai", "voyage", "local"]).default("openai"),
    OPENAI_API_KEY: optionalString,
    EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
    // MUST equal the vector() column dimension defined in M2's schema.
    EMBEDDING_DIM: intFromEnv(1536),

    // --- Twilio (SMS/MMS) — wired in M5 ---
    TWILIO_ACCOUNT_SID: optionalString,
    TWILIO_AUTH_TOKEN: optionalString,
    TWILIO_MESSAGING_SERVICE_SID: optionalString,
    TWILIO_FROM_NUMBER: optionalString,
    // Hard gate: real outbound SMS is only ever sent when this is true.
    SEND_REAL_SMS: boolFromEnv,

    // --- Shopify (custom app, single store for V1) — wired in M4 ---
    SHOPIFY_SHOP_DOMAIN: optionalString,
    SHOPIFY_ADMIN_ACCESS_TOKEN: optionalString,
    SHOPIFY_API_VERSION: optionalString,
    SHOPIFY_WEBHOOK_SECRET: optionalString,

    // --- Slack (escalation notify) — wired in M7 ---
    SLACK_WEBHOOK_URL: optionalString,

    // --- Langfuse (optional tracing) — wired in M6 ---
    LANGFUSE_PUBLIC_KEY: optionalString,
    LANGFUSE_SECRET_KEY: optionalString,
    LANGFUSE_BASEURL: optionalString,

    // --- Tracking (optional; heuristic default in V1) — wired in M8 ---
    TRACKING_PROVIDER: z.enum(["heuristic", "easypost"]).default("heuristic"),
    EASYPOST_API_KEY: optionalString,
    DELIVERY_HEURISTIC_DAYS: intFromEnv(5),

    // --- Encryption (integration credentials at rest) — used in M2/M4 ---
    ENCRYPTION_KEY: z
      .string()
      .min(1, "ENCRYPTION_KEY is required")
      .refine((v) => {
        try {
          return Buffer.from(v, "base64").length === 32;
        } catch {
          return false;
        }
      }, "ENCRYPTION_KEY must be 32 bytes encoded as base64 (generate with `openssl rand -base64 32`)"),
  })
  .superRefine((cfg, ctx) => {
    // Safety cross-check: enabling real SMS without a sender is always a bug.
    if (cfg.SEND_REAL_SMS && !cfg.TWILIO_MESSAGING_SERVICE_SID && !cfg.TWILIO_FROM_NUMBER) {
      ctx.addIssue({
        code: "custom",
        path: ["SEND_REAL_SMS"],
        message:
          "SEND_REAL_SMS=true requires TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER to be set",
      });
    }

    // Production-only requirements. Kept optional in development/test so the
    // local M1/M2 stack boots without any external API keys, and skipped during
    // `next build` (NEXT_PHASE=phase-production-build) since a build must never
    // require runtime service secrets — they are enforced at production runtime.
    const isNextBuild = process.env.NEXT_PHASE === "phase-production-build";
    if (cfg.NODE_ENV === "production" && !isNextBuild) {
      if (!cfg.ANTHROPIC_API_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["ANTHROPIC_API_KEY"],
          message: "ANTHROPIC_API_KEY is required in production",
        });
      }
      if (cfg.EMBEDDINGS_PROVIDER === "openai" && !cfg.OPENAI_API_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["OPENAI_API_KEY"],
          message: "OPENAI_API_KEY is required in production when EMBEDDINGS_PROVIDER=openai",
        });
      }
    }
  });

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(env)"}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment configuration:\n${details}\n\n` +
      `Fix these in your .env file (see .env.example for the full template).`,
  );
}

/** Validated, immutable environment. Import this instead of touching process.env. */
export const env = Object.freeze(parsed.data);

export type Env = typeof env;
