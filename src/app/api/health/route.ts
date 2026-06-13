import { NextResponse } from "next/server";

import { pool } from "@/lib/db/client";
import { redis } from "@/lib/redis";

// pg and ioredis require the Node.js runtime, and health must never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHECK_TIMEOUT_MS = 2000;

/** Resolve `p`, or reject once `ms` elapses — so a hung dependency can't hang the check. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
  });
  return Promise.race([p.finally(() => clearTimeout(timer)), timeout]);
}

async function checkDb(): Promise<boolean> {
  try {
    await withTimeout(pool.query("SELECT 1"), CHECK_TIMEOUT_MS);
    return true;
  } catch {
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    const pong = await withTimeout(redis.ping(), CHECK_TIMEOUT_MS);
    return pong === "PONG";
  } catch {
    return false;
  }
}

/**
 * Liveness/readiness probe. Returns 200 only when both Postgres and Redis answer;
 * 503 otherwise. No auth — safe to expose to load balancers and uptime checks.
 */
export async function GET() {
  const [dbOk, redisOk] = await Promise.all([checkDb(), checkRedis()]);
  const healthy = dbOk && redisOk;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      db: dbOk ? "ok" : "down",
      redis: redisOk ? "ok" : "down",
      time: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
