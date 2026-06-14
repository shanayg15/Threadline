/** Client-safe (JSON-serialized) shapes passed from the thread server component into the
 * client ThreadView. Dates are ISO strings so they match the polling route's JSON. */

export type ThreadMessage = {
  id: string;
  direction: "inbound" | "outbound";
  sender: "customer" | "ai" | "human";
  body: string | null;
  mediaUrls: string[] | null;
  deliveryStatus: "queued" | "sent" | "delivered" | "failed" | "received" | null;
  createdAt: string;
};

export type ThreadDraft = {
  id: string;
  body: string | null;
  model: string | null;
  createdAt: string;
};

export type ThreadOrder = {
  id: string;
  shopifyOrderId: string | null;
  totalCents: number | null;
  fulfillmentStatus: "unfulfilled" | "fulfilled" | "partial";
  createdAt: string;
};

export type ThreadCustomer = {
  id: string;
  name: string | null;
  phoneE164: string;
  consentStatus: "opted_in" | "opted_out" | "unknown";
  experimentGroup: "treatment" | "control" | null;
  timezone: string;
};

export type ThreadConversation = {
  id: string;
  status: "automated" | "escalated" | "blocked" | "closed";
  assigneeType: "ai" | "human";
  assigneeName: string | null;
  paused: boolean;
};

export type ThreadPendingAction = {
  id: string;
  type: string;
  summary: string | null;
};
