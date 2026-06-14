import { env } from "@/lib/config/env";

import { HeuristicTracking } from "./heuristic";
import type { DeliveryInfo, TrackingInput, TrackingProvider } from "./types";

/**
 * EasyPost-backed tracking — DOCUMENTED STUB for V1.
 *
 * A real implementation would, given an `EASYPOST_API_KEY` and a `trackingNumber`,
 * call the EasyPost Tracker API
 * (`GET https://api.easypost.com/v2/trackers?tracker[tracking_code]=...`) and map
 * its `status` ("delivered" | "in_transit" | ...) and `est_delivery_date` onto a
 * `DeliveryInfo`.
 *
 * For V1 that network call is intentionally NOT made — we keep this honest rather
 * than fabricate an API integration. With or without credentials this provider
 * delegates to the heuristic estimator, so behaviour is correct and deterministic
 * today and the real lookup can be slotted into `getDelivery` later.
 */
export class EasyPostTracking implements TrackingProvider {
  readonly name = "easypost";

  private readonly heuristic = new HeuristicTracking();

  getDelivery(input: TrackingInput): Promise<DeliveryInfo> {
    // No credentials or no tracking number -> nothing to look up; use the heuristic.
    if (!env.EASYPOST_API_KEY || !input.trackingNumber) {
      return this.heuristic.getDelivery(input);
    }

    // TODO(V2): real EasyPost Tracker lookup goes here.
    //   const res = await fetch("https://api.easypost.com/v2/trackers?...",
    //     { headers: { Authorization: `Bearer ${env.EASYPOST_API_KEY}` } });
    //   ...map res.status / res.est_delivery_date -> DeliveryInfo
    // Until then, delegate to the heuristic so we never invent carrier data.
    return this.heuristic.getDelivery(input);
  }
}
