import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock every external boundary; the agent loop, tools, stub model, and critique are
// REAL. No ANTHROPIC_API_KEY in the test env, so getAgentModel() returns the stub.
vi.mock("@/lib/db/repos/conversations", () => ({
  getWithMessages: vi.fn(),
  setStatus: vi.fn(async () => ({})),
  setAssignee: vi.fn(async () => ({})),
  createDraft: vi.fn(async () => ({ id: "draft1" })),
}));
vi.mock("@/lib/db/repos/brands", () => ({ getById: vi.fn() }));
vi.mock("@/lib/db/repos/audit", () => ({ record: vi.fn(async () => ({})) }));
vi.mock("@/lib/db/repos/products", () => ({
  listVariants: vi.fn(async () => [{ id: "v1", title: "Rain Jacket / M", options: {} }]),
}));
vi.mock("@/lib/db/repos/pendingActions", () => ({
  getOpen: vi.fn(async () => undefined),
  create: vi.fn(async () => ({ id: "pa1" })),
}));
vi.mock("@/lib/commerce", () => ({ getCommerceProvider: vi.fn() }));
vi.mock("@/lib/channels/outbound", () => ({
  sendOutbound: vi.fn(async () => ({ sent: true, providerMessageId: "mock_x" })),
}));
// getAgentModel is mocked so we can inject a misbehaving model; it defaults (in
// beforeEach) to the REAL stub so every other test exercises the real loop.
vi.mock("./model", () => ({ getAgentModel: vi.fn(), usingRealModel: vi.fn(() => false) }));

import { sendOutbound } from "@/lib/channels/outbound";
import { getCommerceProvider } from "@/lib/commerce";
import * as brands from "@/lib/db/repos/brands";
import * as conversations from "@/lib/db/repos/conversations";
import * as pendingActions from "@/lib/db/repos/pendingActions";
import { respond } from "./index";
import { getAgentModel } from "./model";
import { StubAgentModel } from "./model-stub";
import type { AgentModel } from "./types";

const fakeCommerce = {
  searchCatalog: vi.fn(async () => [
    {
      productId: "p1",
      variantId: null,
      title: "Rain Jacket",
      sourceType: "catalog",
      snippet: "x",
      distance: 0.1,
    },
  ]),
  getVariantLive: vi.fn(async () => ({
    variantId: "v1",
    title: "Rain Jacket / M",
    priceCents: 9800,
    inventoryQty: 5,
    available: true,
    options: {},
  })),
  getOrderStatus: vi.fn(async () => ({
    orderId: "o1",
    shopifyOrderId: "S1",
    status: "fulfilled",
    fulfillmentStatus: "fulfilled" as const,
    trackingNumber: "1Z999",
    carrier: "UPS",
    shippedAt: new Date("2026-06-10T00:00:00Z"),
    deliveredAt: null,
  })),
  getCustomerHistory: vi.fn(async () => [
    {
      orderId: "o1",
      shopifyOrderId: "S1",
      totalCents: 9800,
      fulfillmentStatus: "fulfilled" as const,
      createdAt: new Date(),
    },
  ]),
};

function makeConvo(
  lastInbound: string,
  consentStatus: "opted_in" | "opted_out" | "unknown" = "opted_in",
) {
  return {
    id: "conv1",
    customer: {
      id: "c1",
      name: "Alex Doe",
      timezone: "America/New_York",
      consentStatus,
      phoneE164: "+15551230001",
    },
    messages: [{ direction: "inbound", body: lastInbound }],
  };
}

const BRAND = {
  id: "b1",
  name: "Demo Apparel Co",
  voiceConfig: {
    agentName: "Riley",
    toneExemplars: [],
    bannedPhrases: [],
    formality: "casual" as const,
  },
  policies: {
    returns: "Free returns within 30 days.",
    shipping: "Free over $75.",
    exchange: "Free size exchanges.",
  },
  supervisedMode: false,
};

/** The body passed to sendOutbound (4th positional arg). */
function sentBody(): string | undefined {
  const call = vi.mocked(sendOutbound).mock.calls[0];
  return call?.[3];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(brands.getById).mockResolvedValue(BRAND as never);
  vi.mocked(getCommerceProvider).mockResolvedValue(fakeCommerce as never);
  vi.mocked(getAgentModel).mockReturnValue(new StubAgentModel());
});

describe("Agent.respond — critique gate: a non-compliant draft is rewritten then escalated, never sent", () => {
  it("a model that keeps claiming completion → escalates, sends the handoff, not the bad text", async () => {
    vi.mocked(conversations.getWithMessages).mockResolvedValue(
      makeConvo("did you place my order?") as never,
    );
    // A model whose draft AND rewrite both falsely claim completion.
    const badModel: AgentModel = {
      name: "bad",
      run: async () => ({
        text: "I've placed your order and charged your card!",
        model: "bad",
        usage: { inputTokens: 10, outputTokens: 5 },
      }),
      rewrite: async () => ({
        text: "Done — I've placed your order!",
        model: "bad",
        usage: { inputTokens: 5, outputTokens: 3 },
      }),
    };
    vi.mocked(getAgentModel).mockReturnValue(badModel);

    const out = await respond("b1", "conv1");

    expect(out.status).toBe("escalated");
    expect(conversations.setStatus).toHaveBeenCalledWith("b1", "conv1", "escalated");
    // The forbidden completion claim is NEVER sent — the handoff goes out instead.
    expect(sentBody()).not.toMatch(/I've placed your order/i);
    expect(sentBody()).toMatch(/teammate/i);
  });
});

describe("Agent.respond — supervised mode holds the reply as a draft", () => {
  it("brand.supervisedMode → creates a draft, does NOT send, returns status 'drafted'", async () => {
    vi.mocked(brands.getById).mockResolvedValue({ ...BRAND, supervisedMode: true } as never);
    vi.mocked(conversations.getWithMessages).mockResolvedValue(
      makeConvo("what is your return policy?") as never,
    );

    const out = await respond("b1", "conv1");

    expect(out.status).toBe("drafted");
    if (out.status === "drafted") expect(out.draftId).toBe("draft1");
    expect(conversations.createDraft).toHaveBeenCalledWith(
      "b1",
      expect.objectContaining({ conversationId: "conv1", body: expect.stringMatching(/30 days/) }),
    );
    expect(sendOutbound).not.toHaveBeenCalled(); // held, not sent
  });
});

describe("Agent.respond — stock/price come from the LIVE read, not RAG", () => {
  it("answers in stock with the live price and uses get_variant_live", async () => {
    vi.mocked(conversations.getWithMessages).mockResolvedValue(
      makeConvo("is the rain jacket in stock?") as never,
    );
    const out = await respond("b1", "conv1");

    expect(out.status).toBe("replied");
    if (out.status === "replied") expect(out.toolsUsed).toContain("get_variant_live");
    expect(fakeCommerce.getVariantLive).toHaveBeenCalled();
    expect(sentBody()).toMatch(/\$98\.00/); // the price only exists on the live read
    expect(sentBody()).toMatch(/in stock/i);
    expect(sendOutbound).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "conv1",
      expect.any(String),
      expect.objectContaining({ sender: "ai", isReply: true }),
    );
  });
});

describe("Agent.respond — side effects are PROPOSE-ONLY", () => {
  it("a purchase proposes a pending action and asks to confirm; nothing is executed", async () => {
    vi.mocked(conversations.getWithMessages).mockResolvedValue(
      makeConvo("I want to buy the rain jacket") as never,
    );
    const out = await respond("b1", "conv1");

    expect(pendingActions.create).toHaveBeenCalledWith(
      "b1",
      expect.objectContaining({ conversationId: "conv1", type: "place_order" }),
    );
    expect(out.status).toBe("replied");
    if (out.status === "replied") expect(out.proposedActionId).toBe("pa1");
    expect(sentBody()).toMatch(/reply yes/i); // asks for confirmation
    expect(sentBody()).not.toMatch(/I've (placed|charged|ordered)/i); // never claims completion
  });
});

describe("Agent.respond — escalation", () => {
  it("'talk to a person' escalates: conversation -> escalated, assignee -> human", async () => {
    vi.mocked(conversations.getWithMessages).mockResolvedValue(
      makeConvo("can I talk to a person?") as never,
    );
    const out = await respond("b1", "conv1");

    expect(out.status).toBe("escalated");
    expect(conversations.setStatus).toHaveBeenCalledWith("b1", "conv1", "escalated");
    expect(conversations.setAssignee).toHaveBeenCalledWith("b1", "conv1", { type: "human" });
  });
});

describe("Agent.respond — never invents a promo", () => {
  it("a discount ask gets a no-promo answer with no code", async () => {
    vi.mocked(conversations.getWithMessages).mockResolvedValue(
      makeConvo("got any promo codes?") as never,
    );
    const out = await respond("b1", "conv1");
    expect(out.status).toBe("replied");
    expect(sentBody()).not.toMatch(/\b[A-Z]{2,}[A-Z0-9]*\d[A-Z0-9]*\b/); // no code token
  });
});

describe("Agent.respond — fail-safe", () => {
  it("an unexpected error never throws: escalates and returns status 'error'", async () => {
    vi.mocked(conversations.getWithMessages).mockResolvedValue(
      makeConvo("is the rain jacket in stock?") as never,
    );
    vi.mocked(getCommerceProvider).mockRejectedValue(new Error("commerce down"));

    const out = await respond("b1", "conv1");
    expect(out.status).toBe("error");
    expect(conversations.setStatus).toHaveBeenCalledWith("b1", "conv1", "escalated");
  });

  it("an opted-out customer is skipped — no reply is sent", async () => {
    vi.mocked(conversations.getWithMessages).mockResolvedValue(
      makeConvo("hi", "opted_out") as never,
    );
    const out = await respond("b1", "conv1");
    expect(out.status).toBe("skipped");
    expect(sendOutbound).not.toHaveBeenCalled();
  });
});
