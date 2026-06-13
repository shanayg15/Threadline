import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/lib/config/env";

/**
 * Singleton Postgres pool + Drizzle client.
 *
 * A single pool is reused across Next.js hot reloads in development (otherwise
 * every reload would leak a new pool and exhaust connections). The Drizzle schema
 * is attached in M2; for now this is a bare client used by the health check.
 */
const globalForDb = globalThis as unknown as { __threadlinePool?: Pool };

export const pool =
  globalForDb.__threadlinePool ?? new Pool({ connectionString: env.DATABASE_URL });

if (env.NODE_ENV !== "production") {
  globalForDb.__threadlinePool = pool;
}

export const db = drizzle(pool);
