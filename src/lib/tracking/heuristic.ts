import { env } from "@/lib/config/env";

import type { DeliveryInfo, TrackingInput, TrackingProvider } from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Zero-dependency delivery estimator. No external API, no DB — pure date math.
 *
 * Rules:
 *  - If the carrier already confirmed delivery (`deliveredAt`), trust it.
 *  - Else, if it shipped, assume delivery `env.DELIVERY_HEURISTIC_DAYS` after
 *    `shippedAt`: past that due date it's treated as delivered (deliveredAt = due),
 *    before it the due date is returned as the ETA.
 *  - Else (never shipped) nothing is known.
 *
 * This is the V1 default and the fallback for every richer provider.
 */
export class HeuristicTracking implements TrackingProvider {
  readonly name = "heuristic";

  getDelivery(input: TrackingInput): Promise<DeliveryInfo> {
    return Promise.resolve(this.resolve(input));
  }

  /** Synchronous core, so other providers can delegate without awaiting. */
  resolve(input: TrackingInput): DeliveryInfo {
    // 1. Carrier-confirmed delivery wins.
    if (input.deliveredAt) {
      return { delivered: true, deliveredAt: input.deliveredAt, eta: null };
    }

    // 2. Shipped but not yet confirmed delivered: estimate from the ship date.
    if (input.shippedAt) {
      const due = new Date(input.shippedAt.getTime() + env.DELIVERY_HEURISTIC_DAYS * MS_PER_DAY);
      if (Date.now() >= due.getTime()) {
        return { delivered: true, deliveredAt: due, eta: null };
      }
      return { delivered: false, deliveredAt: null, eta: due };
    }

    // 3. Never shipped: nothing known.
    return { delivered: false, deliveredAt: null, eta: null };
  }
}
