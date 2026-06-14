import { notFound } from "next/navigation";

import { getActiveBrand } from "@/lib/auth/brand";
import * as brands from "@/lib/db/repos/brands";
import * as conversations from "@/lib/db/repos/conversations";
import * as orders from "@/lib/db/repos/orders";
import * as pendingActions from "@/lib/db/repos/pendingActions";
import * as users from "@/lib/db/repos/users";

import { ThreadView } from "../thread-view";
import type {
  ThreadConversation,
  ThreadCustomer,
  ThreadDraft,
  ThreadMessage,
  ThreadOrder,
  ThreadPendingAction,
} from "../types";

export const dynamic = "force-dynamic";

function isVisible(approvalStatus: string | null): boolean {
  return approvalStatus == null || approvalStatus === "approved";
}

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { brandId, role } = await getActiveBrand();

  const convo = await conversations.getWithMessages(brandId, id);
  if (!convo || !convo.customer) notFound();

  const [brand, orderRows, openAction, assigneeUser] = await Promise.all([
    brands.getById(brandId),
    orders.listForCustomer(brandId, convo.customer.id),
    pendingActions.getOpen(brandId, id),
    convo.assigneeUserId ? users.getById(brandId, convo.assigneeUserId) : Promise.resolve(undefined),
  ]);

  const messages: ThreadMessage[] = convo.messages
    .filter((m) => isVisible(m.approvalStatus))
    .map((m) => ({
      id: m.id,
      direction: m.direction,
      sender: m.sender,
      body: m.body,
      mediaUrls: m.mediaUrls,
      deliveryStatus: m.deliveryStatus,
      createdAt: m.createdAt.toISOString(),
    }));

  const draftRow = convo.messages.find((m) => m.approvalStatus === "pending");
  const draft: ThreadDraft | null = draftRow
    ? {
        id: draftRow.id,
        body: draftRow.body,
        model: draftRow.model,
        createdAt: draftRow.createdAt.toISOString(),
      }
    : null;

  const customer: ThreadCustomer = {
    id: convo.customer.id,
    name: convo.customer.name,
    phoneE164: convo.customer.phoneE164,
    consentStatus: convo.customer.consentStatus,
    experimentGroup: convo.customer.experimentGroup,
    timezone: convo.customer.timezone,
  };

  const conversation: ThreadConversation = {
    id: convo.id,
    status: convo.status,
    assigneeType: convo.assigneeType,
    assigneeName: assigneeUser?.name ?? null,
    paused: convo.paused,
  };

  const threadOrders: ThreadOrder[] = orderRows.map((o) => ({
    id: o.id,
    shopifyOrderId: o.shopifyOrderId,
    totalCents: o.totalCents,
    fulfillmentStatus: o.fulfillmentStatus,
    createdAt: o.createdAt.toISOString(),
  }));

  const pendingAction: ThreadPendingAction | null = openAction
    ? {
        id: openAction.id,
        type: openAction.type,
        summary:
          typeof openAction.payload?.summary === "string" ? openAction.payload.summary : null,
      }
    : null;

  return (
    <ThreadView
      conversation={conversation}
      customer={customer}
      initialMessages={messages}
      initialDraft={draft}
      orders={threadOrders}
      pendingAction={pendingAction}
      supervised={brand?.supervisedMode ?? false}
      canMutate={role === "owner" || role === "agent"}
    />
  );
}
