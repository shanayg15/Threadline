import { canSendOutbound } from "@/lib/compliance";
import * as auditRepo from "@/lib/db/repos/audit";
import * as brandsRepo from "@/lib/db/repos/brands";
import * as conversationsRepo from "@/lib/db/repos/conversations";
import * as customersRepo from "@/lib/db/repos/customers";
import * as eventsRepo from "@/lib/db/repos/events";
import type { Event } from "@/lib/db/repos/events";
import * as playbooksRepo from "@/lib/db/repos/playbooks";
import { ensureExperimentGroup } from "@/lib/measure/groups";

import { enqueueOutbound } from "./queues";

/**
 * The lifecycle scheduler: drain unprocessed events, claim each (so a retry / second
 * worker can't double-handle), match enabled playbooks, gate on consent + HOLDOUT, and
 * enqueue a quiet-hours-respecting delayed outbound job. Compliance + holdout are
 * RE-CHECKED at send time too (state can change between scheduling and sending).
 */
export async function runLifecycleSweep(): Promise<{ events: number; scheduled: number }> {
  const events = await eventsRepo.listUnprocessedAll(200);
  let scheduled = 0;
  for (const event of events) {
    const claimed = await eventsRepo.markProcessed(event.brandId, event.id);
    if (!claimed) continue; // already handled by another pass
    scheduled += await scheduleForEvent(event);
  }
  return { events: events.length, scheduled };
}

async function scheduleForEvent(event: Event): Promise<number> {
  if (!event.customerId) return 0;
  const playbooks = (await playbooksRepo.list(event.brandId)).filter(
    (p) => p.enabled && p.triggerType === event.type,
  );
  if (playbooks.length === 0) return 0;

  const [brand, customer] = await Promise.all([
    brandsRepo.getById(event.brandId),
    customersRepo.getById(event.brandId, event.customerId),
  ]);
  if (!brand || !customer) return 0;

  // Proactive outreach requires explicit opt-in.
  if (customer.consentStatus !== "opted_in") return 0;

  // HOLDOUT: assign a stable experiment group; the control group is NEVER messaged.
  const group = await ensureExperimentGroup(event.brandId, customer);
  if (group !== "treatment") {
    await auditRepo.record(event.brandId, {
      actor: "system",
      action: "proactive_skipped_holdout",
      targetType: "customer",
      targetId: customer.id,
      payload: { event: event.type },
    });
    return 0;
  }

  const conversation = await conversationsRepo.getOrCreateForCustomer(
    event.brandId,
    customer.id,
    "sms",
  );
  const now = new Date();
  let n = 0;
  for (const playbook of playbooks) {
    let sendAt = new Date(now.getTime() + (playbook.delayMinutes ?? 0) * 60_000);
    // Respect quiet hours at the intended send time: push to the next allowed instant.
    const decision = canSendOutbound({
      brand: { quietHours: brand.quietHours, frequencyCaps: brand.frequencyCaps },
      customer: { consentStatus: customer.consentStatus, timezone: customer.timezone },
      now: sendAt,
      isReply: false,
    });
    if (!decision.allowed && decision.nextAllowedAt && decision.reason.includes("quiet")) {
      sendAt = decision.nextAllowedAt;
    }
    await enqueueOutbound(
      {
        brandId: event.brandId,
        conversationId: conversation.id,
        customerId: customer.id,
        playbookKey: playbook.key,
        kind: "delivery_checkin",
      },
      { delayMs: sendAt.getTime() - now.getTime(), jobId: `checkin:${event.id}:${playbook.id}` },
    );
    n++;
  }
  return n;
}
