import { Queue } from "bullmq";

import { bullConnection } from "./connection";

/** Queue names (prefixed so they don't collide with other apps on a shared Redis). */
export const QUEUE = {
  lifecycle: "tl_lifecycle",
  outbound: "tl_outbound",
  maintenance: "tl_maintenance",
} as const;

export type OutboundKind = "delivery_checkin" | "no_response_reminder";

export type OutboundJobData = {
  brandId: string;
  conversationId: string;
  customerId: string;
  playbookKey: string;
  kind: OutboundKind;
};

let _outbound: Queue<OutboundJobData> | undefined;
let _lifecycle: Queue | undefined;
let _maintenance: Queue | undefined;

export function outboundQueue(): Queue<OutboundJobData> {
  _outbound ??= new Queue<OutboundJobData>(QUEUE.outbound, { connection: bullConnection });
  return _outbound;
}
export function lifecycleQueue(): Queue {
  _lifecycle ??= new Queue(QUEUE.lifecycle, { connection: bullConnection });
  return _lifecycle;
}
export function maintenanceQueue(): Queue {
  _maintenance ??= new Queue(QUEUE.maintenance, { connection: bullConnection });
  return _maintenance;
}

/**
 * Enqueue a single outbound send at its allowed time. The `jobId` makes it idempotent —
 * BullMQ ignores a duplicate add with the same id, so a re-run of the scheduler (or a
 * Shopify webhook retry that re-emits the event) never double-schedules the same send.
 */
export async function enqueueOutbound(
  data: OutboundJobData,
  opts: { delayMs: number; jobId: string },
): Promise<void> {
  await outboundQueue().add(data.kind, data, {
    delay: Math.max(0, Math.round(opts.delayMs)),
    jobId: opts.jobId,
    removeOnComplete: 500,
    removeOnFail: 500,
  });
}

/** Close every queue connection (graceful shutdown). */
export async function closeQueues(): Promise<void> {
  await Promise.all([_outbound?.close(), _lifecycle?.close(), _maintenance?.close()]);
}
