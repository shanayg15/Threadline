import Redis from "ioredis";

import { env } from "@/lib/config/env";

/**
 * Singleton Redis client for the Next.js app process (the worker process owns its
 * own connection). `lazyConnect` defers the TCP connection until the first command
 * so that importing this module never throws when Redis is down — callers (e.g. the
 * health check) decide how to handle connectivity failures.
 */
const globalForRedis = globalThis as unknown as { __threadlineRedis?: Redis };

export const redis =
  globalForRedis.__threadlineRedis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

if (env.NODE_ENV !== "production") {
  globalForRedis.__threadlineRedis = redis;
}
