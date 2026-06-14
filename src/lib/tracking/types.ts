/**
 * Delivery tracking types.
 *
 * Server-only: providers read `env` and may (in future) call external tracking
 * APIs, so this module must never be imported into a client component.
 */

/** Resolved delivery state for a single order/shipment. */
export type DeliveryInfo = {
  /** True once the package is considered delivered. */
  delivered: boolean;
  /** When it was delivered, if known. Null while still in transit / never shipped. */
  deliveredAt: Date | null;
  /** Estimated arrival, if known and not yet delivered. Null otherwise. */
  eta: Date | null;
};

/** The minimal shipment facts a provider needs to resolve delivery. */
export type TrackingInput = {
  /** When the order shipped, or null if it has not shipped yet. */
  shippedAt: Date | null;
  /** Carrier-confirmed delivery timestamp, or null if not yet (or unknown). */
  deliveredAt: Date | null;
  /** Carrier tracking number, when available (used by the real-API providers). */
  trackingNumber?: string | null;
};

/**
 * A pluggable delivery-tracking strategy. Implementations are selected by
 * `getTrackingProvider()` based on env configuration.
 */
export interface TrackingProvider {
  /** Stable identifier for the strategy (e.g. "heuristic", "easypost"). */
  readonly name: string;
  /** Resolve the current delivery state for the given shipment facts. */
  getDelivery(input: TrackingInput): Promise<DeliveryInfo>;
}
