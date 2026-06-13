import { defineConfig } from "drizzle-kit";

// drizzle-kit loads this file with its own bundler and does NOT resolve the
// "@/*" tsconfig alias, so import env via a relative path here.
import { env } from "./src/lib/config/env";

export default defineConfig({
  // The schema dir is created in M2; pointing at a not-yet-existing path is fine.
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  // camelCase fields in TS map to snake_case columns in Postgres.
  casing: "snake_case",
  strict: true,
  verbose: true,
});
