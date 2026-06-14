import { createHash } from "node:crypto";

import { attributions, conversations, orders } from "@/lib/db/repos";

/**
 * A stable, short, uppercase attribution code for a conversation.
 *
 * Deterministic: the same conversation always produces the same code, so the
 * code stamped on a checkout link round-trips back to its conversation when a
 * discount code comes through on a Shopify order.
 */
export function attributionCodeFor(conversationId: string): string {
  return "TL" + createHash("sha256").update(conversationId).digest("hex").slice(0, 8).toUpperCase();
}

export type RecordOrderAttributionResult = {
  attributed: boolean;
  conversationId?: string;
};

/**
 * Attribute a Shopify order to the conversation that drove it, via a discount code.
 *
 * For each discount code (uppercased) we resolve the conversation by its
 * attribution code; on the first match we load the order and — only if it exists
 * and is not already attributed — record the attribution and stamp the order.
 *
 * Idempotent: the `attributedConversationId === null` guard plus the repo's
 * conditional update mean a webhook retry won't double-record.
 */
export async function recordOrderAttribution(
  brandId: string,
  params: { shopifyOrderId: string; discountCodes: string[]; totalCents: number | null },
): Promise<RecordOrderAttributionResult> {
  for (const rawCode of params.discountCodes) {
    const code = rawCode.toUpperCase();
    const conversation = await conversations.getByAttributionCode(brandId, code);
    if (!conversation) continue;

    const order = await orders.getByShopifyOrderId(brandId, params.shopifyOrderId);
    if (!order) return { attributed: false };

    // Already attributed (e.g. a webhook retry): treat as a no-op success.
    if (order.attributedConversationId !== null) {
      return { attributed: false };
    }

    await attributions.record(brandId, {
      conversationId: conversation.id,
      orderId: order.id,
      discountCode: code,
      attributedRevenueCents: params.totalCents ?? null,
      linkClicked: false,
    });
    await orders.setAttributedConversation(brandId, order.id, conversation.id);

    return { attributed: true, conversationId: conversation.id };
  }

  return { attributed: false };
}
