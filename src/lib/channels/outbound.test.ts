import { beforeEach, describe, expect, it, vi } from "vitest";

// The send gate's wiring is the trust-critical seam: the mandated STOP/HELP/START
// confirmation MUST reach a just-opted-out number, while EVERYTHING else must be
// blocked + audited. These tests pin that wiring with the repos + channel mocked.

vi.mock("@/lib/db/client", () => ({
  // recentOutboundCounts() awaits db.select().from().where(); 0 rows = under caps.
  db: { select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }) },
}));
vi.mock("@/lib/db/repos/audit", () => ({ record: vi.fn(async () => {}) }));
vi.mock("@/lib/db/repos/conversations", () => ({
  appendMessage: vi.fn(async () => ({ id: "msg_1" })),
}));
vi.mock("./twilio", () => ({
  twilioChannel: {
    send: vi.fn(async () => ({ providerMessageId: "mock_test", status: "sent" })),
  },
}));

import * as audit from "@/lib/db/repos/audit";
import * as conversations from "@/lib/db/repos/conversations";
import { sendComplianceReply, sendOutbound } from "./outbound";
import { twilioChannel } from "./twilio";

const brand = { id: "b1", quietHours: null, frequencyCaps: null };
const optedOut = {
  id: "c1",
  phoneE164: "+15551230001",
  consentStatus: "opted_out" as const,
  timezone: "America/New_York",
};
const optedIn = { ...optedOut, consentStatus: "opted_in" as const };

beforeEach(() => vi.clearAllMocks());

describe("sendComplianceReply — bypasses the gate (reaches a just-opted-out number)", () => {
  it("sends and records the mandated confirmation even though the customer is opted out", async () => {
    const result = await sendComplianceReply(brand, optedOut, "conv1", "You're unsubscribed.");

    expect(result).toEqual({ sent: true, providerMessageId: "mock_test" });
    expect(twilioChannel.send).toHaveBeenCalledTimes(1);
    expect(twilioChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+15551230001", body: "You're unsubscribed." }),
    );
    // Persisted as an automated (ai) outbound, with the provider id + status.
    expect(conversations.appendMessage).toHaveBeenCalledWith(
      "b1",
      expect.objectContaining({
        direction: "outbound",
        sender: "ai",
        channelMessageId: "mock_test",
        deliveryStatus: "sent",
      }),
    );
    // A bypassed reply is not a block — no outbound_blocked audit.
    expect(audit.record).not.toHaveBeenCalled();
  });
});

describe("sendOutbound — the default gate blocks an opted-out number", () => {
  it("does NOT send, returns the reason, and audits the block", async () => {
    const result = await sendOutbound(brand, optedOut, "conv1", "Flash sale!", { sender: "ai" });

    expect(result).toEqual({ sent: false, reason: expect.stringMatching(/opted out/) });
    expect(twilioChannel.send).not.toHaveBeenCalled();
    expect(conversations.appendMessage).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      "b1",
      expect.objectContaining({ action: "outbound_blocked", targetType: "conversation" }),
    );
  });
});

describe("sendOutbound — a permitted proactive send goes through", () => {
  it("sends to an opted-in customer with no quiet hours / caps", async () => {
    const result = await sendOutbound(brand, optedIn, "conv1", "Your order shipped!", {
      sender: "ai",
    });

    expect(result).toEqual({ sent: true, providerMessageId: "mock_test" });
    expect(twilioChannel.send).toHaveBeenCalledTimes(1);
    expect(audit.record).not.toHaveBeenCalled();
  });
});
