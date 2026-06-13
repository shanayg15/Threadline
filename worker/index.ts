import Redis from "ioredis";

import { env } from "@/lib/config/env";

/**
 * Threadline background worker.
 *
 * For M1 this is a minimal long-lived process that just proves Redis
 * connectivity and stays alive. BullMQ queues, the lifecycle scheduler, and
 * job processors are added in M8 — nothing job-related is scaffolded here.
 */
async function main() {
  const redis = new Redis(env.REDIS_URL, {
    // BullMQ requires this to be null; harmless for the plain client today.
    maxRetriesPerRequest: null,
  });

  redis.on("error", (err) => {
    console.error("[worker] redis error:", err.message);
  });

  const pong = await redis.ping();
  console.log(`[worker] worker up (redis ${pong})`);

  // The open Redis connection keeps the event loop alive. Drain it cleanly on
  // termination so `pnpm worker` exits gracefully.
  const shutdown = async (signal: NodeJS.Signals) => {
    console.log(`[worker] received ${signal}, shutting down`);
    await redis.quit();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
