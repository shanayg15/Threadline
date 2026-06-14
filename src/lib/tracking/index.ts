import { env } from "@/lib/config/env";

import { EasyPostTracking } from "./easypost";
import { HeuristicTracking } from "./heuristic";
import type { TrackingProvider } from "./types";

export type { DeliveryInfo, TrackingInput, TrackingProvider } from "./types";

/**
 * Resolve the delivery-tracking provider from env config: the EasyPost provider
 * when `TRACKING_PROVIDER=easypost` AND an API key is configured, otherwise the
 * zero-dependency heuristic estimator (the V1 default). Mirrors the selection
 * style of `getCommerceProvider`.
 */
export function getTrackingProvider(): TrackingProvider {
  if (env.TRACKING_PROVIDER === "easypost" && env.EASYPOST_API_KEY) {
    return new EasyPostTracking();
  }
  return new HeuristicTracking();
}
