import { beforeEach, describe, expect, it, vi } from "vitest";

// The money path. Mock every boundary; the gate logic + classifier are real.
vi.mock("@/lib/db/repos/pendingActions", () => ({
  getOpen: vi.fn(),
  confirm: vi.fn(),
  cancel: vi.fn(async () => ({})),
  expire: vi.fn(async () => ({})),
}));
vi.mock("@/lib/db/repos/conversations", () => ({
  setAttributionCode: vi.fn(async () => ({})),
  setStatus: vi.fn(async () => ({})),
  setAssignee: vi.fn(async () => ({})),
}));
vi.mock("@/lib/db/repos/audit", () => ({ record: vi.fn(async () => ({})) }));
vi.mock("@/lib/measure/attribution", () => ({ attributionCodeFor: () => "TLTESTCODE" }));
vi.mock("@/lib/commerce", () => ({ getCommerceProvider: vi.fn() }));
vi.mock("@/lib/channels/outbound", () => ({
  sendOrHold: vi.fn(async () => ({ outcome: "sent", providerMessageId: "mock_x" })),
}));

import { sendOrHold } from "@/lib/channels/outbound";
import { getCommerceProvider } from "@/lib/commerce";
import * as audit from "@/lib/db/repos/audit";
import * as pendingActions from "@/lib/db/repos/pendingActions";
import { runConfirmationGate } from "./gate";

const BRAND = {
  id: "b1",
  name: "Demo Apparel Co",
  voiceConfig: { agentName: "Riley", toneExemplars: [], bannedPhrases: [], formality: "casual" },
  policies: null,
  quietHours: null,
  frequencyCaps: null,
  supervisedMode: true, // even supervised, the confirmation reply SENDS (not held)
} as never;

function convo(lastInbound: string) {
  return {
    id: "conv1",
    customer: {
      id: "c1",
      phoneE164: "+15551230001",
      consentStatus: "opted_in",
      timezone: "America/New_York",
    },
    messages: [{ direction: "inbound", body: lastInbound, approvalStatus: null }],
  } as never;
}

const openAction = {
  id: "pa1",
  type: "place_order",
  payload: { variantId: "v1", quantity: 1, summary: "Order 1x" },
  expiresAt: new Date(Date.now() + 86_400_000),
};

const checkoutLink = { url: "https://demo-apparel.example/cart/v1:1?discount=TLTESTCODE" };
const fakeCommerce = { createCheckoutLink: vi.fn(async () => checkoutLink) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCommerceProvider).mockResolvedValue(fakeCommerce as never);
  fakeCommerce.createCheckoutLink.mockResolvedValue(checkoutLink);
});

describe("runConfirmationGate — confirm executes a customer-paid checkout link", () => {
  it("'yes' → claims the action, builds the link, audits, and SENDS it", async () => {
    vi.mocked(pendingActions.getOpen).mockResolvedValue(openAction as never);
    vi.mocked(pendingActions.confirm).mockResolvedValue(openAction as never); // claim won

    const r = await runConfirmationGate(BRAND, convo("yes please"));

    expect(r.handled).toBe(true);
    expect(r.outcome).toMatchObject({ status: "gate", action: "executed", sent: true });
    expect(pendingActions.confirm).toHaveBeenCalledWith("b1", "pa1"); // claimed BEFORE the link
    expect(fakeCommerce.createCheckoutLink).toHaveBeenCalledWith(
      "b1",
      [{ variantId: "v1", quantity: 1 }],
      { discountCode: "TLTESTCODE" },
    );
    expect(audit.record).toHaveBeenCalledWith(
      "b1",
      expect.objectContaining({ action: "action_executed" }),
    );
    // The link is SENT (supervised:false) — never held, never lost.
    expect(sendOrHold).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "conv1",
      expect.stringContaining("checkout link"),
      expect.objectContaining({ supervised: false }),
    );
  });

  it("a duplicate/concurrent 'yes' loses the claim → no second link, no second send", async () => {
    vi.mocked(pendingActions.getOpen).mockResolvedValue(openAction as never);
    vi.mocked(pendingActions.confirm).mockResolvedValue(undefined); // already claimed

    const r = await runConfirmationGate(BRAND, convo("yes"));

    expect(r.outcome).toMatchObject({ status: "gate", action: "executed", sent: false });
    expect(fakeCommerce.createCheckoutLink).not.toHaveBeenCalled();
    expect(sendOrHold).not.toHaveBeenCalled();
  });
});

describe("runConfirmationGate — decline / unclear never execute", () => {
  it("'no' → cancels, no checkout link", async () => {
    vi.mocked(pendingActions.getOpen).mockResolvedValue(openAction as never);
    const r = await runConfirmationGate(BRAND, convo("no thanks"));
    expect(r.outcome).toMatchObject({ status: "gate", action: "declined" });
    expect(pendingActions.cancel).toHaveBeenCalledWith("b1", "pa1");
    expect(fakeCommerce.createCheckoutLink).not.toHaveBeenCalled();
  });

  it("'maybe' → asks to clarify, does not cancel or execute", async () => {
    vi.mocked(pendingActions.getOpen).mockResolvedValue(openAction as never);
    const r = await runConfirmationGate(BRAND, convo("maybe, what's the price?"));
    expect(r.outcome).toMatchObject({ status: "gate", action: "unclear" });
    expect(pendingActions.cancel).not.toHaveBeenCalled();
    expect(fakeCommerce.createCheckoutLink).not.toHaveBeenCalled();
  });

  it("no open action → falls through to the normal agent run", async () => {
    vi.mocked(pendingActions.getOpen).mockResolvedValue(undefined);
    const r = await runConfirmationGate(BRAND, convo("hello"));
    expect(r.handled).toBe(false);
  });
});
