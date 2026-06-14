import { getCommerceProvider } from "@/lib/commerce";
import * as brandsRepo from "@/lib/db/repos/brands";
import * as eventsRepo from "@/lib/db/repos/events";
import * as integrationsRepo from "@/lib/db/repos/integrations";
import * as ordersRepo from "@/lib/db/repos/orders";
import * as pendingActionsRepo from "@/lib/db/repos/pendingActions";
import { embedBrandKnowledge } from "@/lib/embeddings/pipeline";
import { getTrackingProvider } from "@/lib/tracking";

/**
 * Frequent maintenance: turn shipped orders into `order_delivered` events once the
 * tracking provider (heuristic delay by default) says they've arrived — this is what the
 * lifecycle scheduler picks up for the delivery check-in — and expire stale pending
 * actions. "Delivered" is deliberately conservative: never check in before arrival.
 */
export async function runMaintenance(): Promise<{ delivered: number; expired: number }> {
  const brands = await brandsRepo.listAll();
  const tracking = getTrackingProvider();
  let delivered = 0;
  let expired = 0;

  for (const brand of brands) {
    const orders = await ordersRepo.listDeliverable(brand.id);
    for (const order of orders) {
      const info = await tracking.getDelivery({
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        trackingNumber: order.trackingNumber,
      });
      if (!info.delivered || !info.deliveredAt) continue;
      const updated = await ordersRepo.setDeliveredAt(brand.id, order.id, info.deliveredAt);
      if (updated && order.customerId) {
        await eventsRepo.recordIfNew(brand.id, {
          type: "order_delivered",
          customerId: order.customerId,
          dedupeKey: `order_delivered:${order.id}`,
          payload: { orderId: order.id },
        });
        delivered++;
      }
    }
    expired += await pendingActionsRepo.expireStale(brand.id);
  }
  return { delivered, expired };
}

/**
 * Nightly: re-sync the catalog + re-embed knowledge for every Shopify-connected brand so
 * the agent's grounding stays current. Best-effort per brand — one brand's failure never
 * blocks the others.
 */
export async function runNightly(): Promise<{ resynced: number }> {
  const brands = await brandsRepo.listAll();
  let resynced = 0;
  for (const brand of brands) {
    const shopify = await integrationsRepo.get(brand.id, "shopify");
    if (shopify?.status !== "connected") continue;
    try {
      const provider = await getCommerceProvider(brand.id);
      await provider.syncCatalog(brand.id);
      await provider.syncCustomers(brand.id);
      await provider.syncOrders(brand.id);
      await embedBrandKnowledge(brand.id);
      resynced++;
    } catch (err) {
      console.error(
        "[maintenance] nightly resync failed",
        brand.id,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return { resynced };
}
