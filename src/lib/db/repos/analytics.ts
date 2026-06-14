import { and, eq, exists, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { attributions, conversations, customers, messages, orders } from "@/lib/db/schema";

/**
 * Brand-scoped analytics aggregates for the Analytics read page (M8).
 *
 * V1 measurement is intentionally HONEST and modest: attribution here is
 * assist-based (an order touched by a thread), NOT incremental lift. True lift
 * requires the treatment-vs-holdout comparison (Phase 3), so this surface reports
 * the treatment/control cohort sizes plainly and does not claim causality.
 */
export type BrandSummary = {
  totalConversations: number;
  conversationsByStatus: { automated: number; escalated: number; blocked: number; closed: number };
  /** Conversations with >= 1 inbound customer message. */
  engagedConversations: number;
  /** engagedConversations / max(totalConversations, 1). */
  engagementRate: number;
  /** Orders with attributedConversationId set (assist-based, V1). */
  attributedOrders: number;
  /** Sum of attributions.attributedRevenueCents (assist-based, V1). */
  attributedRevenueCents: number;
  treatmentCount: number;
  controlCount: number;
  unassignedCount: number;
  /** Sum of messages.costCents for outbound AI messages. */
  agentCostCents: number;
};

export async function brandSummary(brandId: string): Promise<BrandSummary> {
  const [statusRows, engaged, attributed, revenue, groups, agentCost] = await Promise.all([
    // Conversation counts grouped by status (only the brand's rows).
    db
      .select({ status: conversations.status, count: sql<number>`count(*)::int` })
      .from(conversations)
      .where(eq(conversations.brandId, brandId))
      .groupBy(conversations.status),

    // Conversations with >= 1 inbound customer message — correlated EXISTS so a
    // conversation is counted once regardless of how many inbound messages it has.
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations)
      .where(
        and(
          eq(conversations.brandId, brandId),
          exists(
            db
              .select({ one: sql`1` })
              .from(messages)
              .where(
                and(
                  eq(messages.conversationId, conversations.id),
                  eq(messages.direction, "inbound"),
                ),
              ),
          ),
        ),
      ),

    // Orders attributed to a conversation (assist-based).
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(eq(orders.brandId, brandId), sql`${orders.attributedConversationId} is not null`),
      ),

    // Attributed revenue (cents), null-safe.
    db
      .select({ cents: sql<number>`coalesce(sum(${attributions.attributedRevenueCents}), 0)::int` })
      .from(attributions)
      .where(eq(attributions.brandId, brandId)),

    // Customers by experiment group (treatment / control / unassigned).
    db
      .select({ group: customers.experimentGroup, count: sql<number>`count(*)::int` })
      .from(customers)
      .where(eq(customers.brandId, brandId))
      .groupBy(customers.experimentGroup),

    // Agent spend: outbound AI message costs, null-safe.
    db
      .select({ cents: sql<number>`coalesce(sum(${messages.costCents}), 0)::int` })
      .from(messages)
      .where(
        and(
          eq(messages.brandId, brandId),
          eq(messages.direction, "outbound"),
          eq(messages.sender, "ai"),
        ),
      ),
  ]);

  const conversationsByStatus: BrandSummary["conversationsByStatus"] = {
    automated: 0,
    escalated: 0,
    blocked: 0,
    closed: 0,
  };
  for (const row of statusRows) {
    conversationsByStatus[row.status] = row.count;
  }
  const totalConversations =
    conversationsByStatus.automated +
    conversationsByStatus.escalated +
    conversationsByStatus.blocked +
    conversationsByStatus.closed;

  const engagedConversations = engaged[0]?.count ?? 0;

  let treatmentCount = 0;
  let controlCount = 0;
  let unassignedCount = 0;
  for (const row of groups) {
    if (row.group === "treatment") treatmentCount = row.count;
    else if (row.group === "control") controlCount = row.count;
    else unassignedCount = row.count; // experimentGroup is null
  }

  return {
    totalConversations,
    conversationsByStatus,
    engagedConversations,
    engagementRate: engagedConversations / Math.max(totalConversations, 1),
    attributedOrders: attributed[0]?.count ?? 0,
    attributedRevenueCents: revenue[0]?.cents ?? 0,
    treatmentCount,
    controlCount,
    unassignedCount,
    agentCostCents: agentCost[0]?.cents ?? 0,
  };
}
