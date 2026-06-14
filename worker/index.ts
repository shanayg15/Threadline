import { Worker, type Job } from "bullmq";

import { env } from "@/lib/config/env";
import { bullConnection } from "@/lib/jobs/connection";
import { runLifecycleSweep } from "@/lib/jobs/lifecycle";
import { runMaintenance, runNightly } from "@/lib/jobs/maintenance";
import { runOutboundJob } from "@/lib/jobs/proactive";
import {
  QUEUE,
  closeQueues,
  lifecycleQueue,
  maintenanceQueue,
  type OutboundJobData,
} from "@/lib/jobs/queues";

/**
 * Threadline background worker (M8). Runs the lifecycle engine:
 *  - a repeatable LIFECYCLE sweep drains events → schedules compliance-gated outbound,
 *  - the OUTBOUND queue sends each scheduled message at its allowed time (or holds a
 *    supervised draft), re-checking compliance + holdout + cancellation,
 *  - a repeatable MAINTENANCE sweep marks deliveries (heuristic) + expires stale actions,
 *  - a nightly cron re-syncs + re-embeds connected brands.
 * Run alongside `pnpm dev` with `pnpm worker`.
 */

// Dev-friendly cadence; production would lengthen these.
const LIFECYCLE_EVERY_MS = 20_000;
const MAINTENANCE_EVERY_MS = 60_000;

async function main() {
  const workers: Worker[] = [
    new Worker(
      QUEUE.lifecycle,
      async () => {
        const r = await runLifecycleSweep();
        if (r.scheduled > 0) console.log(`[worker] lifecycle: ${r.scheduled} scheduled from ${r.events} events`);
      },
      { connection: bullConnection },
    ),
    new Worker<OutboundJobData>(
      QUEUE.outbound,
      async (job: Job<OutboundJobData>) => {
        await runOutboundJob(job.data);
      },
      { connection: bullConnection },
    ),
    new Worker(
      QUEUE.maintenance,
      async (job: Job) => {
        if (job.name === "nightly") {
          const r = await runNightly();
          if (r.resynced > 0) console.log(`[worker] nightly: re-synced ${r.resynced} brand(s)`);
        } else {
          const r = await runMaintenance();
          if (r.delivered > 0 || r.expired > 0)
            console.log(`[worker] maintenance: ${r.delivered} delivered, ${r.expired} expired`);
        }
      },
      { connection: bullConnection },
    ),
  ];

  for (const w of workers) {
    w.on("failed", (job, err) => console.error(`[worker] ${job?.queueName} job failed:`, err.message));
  }

  // Register the repeatable (cron) jobs. The fixed jobId means re-running the worker
  // doesn't pile up duplicate schedulers.
  await lifecycleQueue().add("sweep", {}, { repeat: { every: LIFECYCLE_EVERY_MS }, jobId: "lifecycle-sweep" });
  await maintenanceQueue().add("maintain", {}, { repeat: { every: MAINTENANCE_EVERY_MS }, jobId: "maintenance-sweep" });
  await maintenanceQueue().add("nightly", {}, { repeat: { pattern: "0 3 * * *" }, jobId: "nightly-resync" });

  console.log(`[worker] up — lifecycle + outbound + maintenance running (SEND_REAL_SMS=${env.SEND_REAL_SMS})`);

  const shutdown = async (signal: NodeJS.Signals) => {
    console.log(`[worker] received ${signal}, shutting down`);
    await Promise.all(workers.map((w) => w.close()));
    await closeQueues();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
