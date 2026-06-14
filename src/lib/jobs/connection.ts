import { env } from "@/lib/config/env";

/**
 * BullMQ connection OPTIONS (a plain object, not an ioredis instance). BullMQ bundles its
 * own ioredis, so we hand it options and let it build the client — passing our app's
 * ioredis instance would cross two ioredis versions. `maxRetriesPerRequest: null` is
 * required by BullMQ. Parsed once from REDIS_URL.
 */
function parse() {
  const u = new URL(env.REDIS_URL);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    username: u.username || undefined,
    password: u.password || undefined,
    ...(u.protocol === "rediss:" ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}

export const bullConnection = parse();
