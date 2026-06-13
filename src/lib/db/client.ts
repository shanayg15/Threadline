import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/lib/config/env";
import * as schema from "@/lib/db/schema";

/**
 * Singleton Postgres pool + Drizzle client.
 *
 * A single pool is reused across Next.js hot reloads in development (otherwise
 * every reload would leak a new pool and exhaust connections). `casing: snake_case`
 * maps camelCase schema fields to snake_case columns, matching drizzle.config.ts.
 */
const globalForDb = globalThis as unknown as { __threadlinePool?: Pool };

export const pool =
  globalForDb.__threadlinePool ?? new Pool({ connectionString: env.DATABASE_URL });

if (env.NODE_ENV !== "production") {
  globalForDb.__threadlinePool = pool;
}

export const db = drizzle(pool, { schema, casing: "snake_case" });

export { schema };
