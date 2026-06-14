import { describe, expect, it } from "vitest";

import { critiqueReply } from "./critique";
import type { AgentBrand } from "./types";

const brand: AgentBrand = {
  id: "b1",
  name: "Demo Apparel Co",
  voice: {
    agentName: "Riley",
    toneExemplars: [],
    bannedPhrases: ["game-changer", "elevate your wardrobe"],
    formality: "casual",
  },
  policies: null,
};

describe("critiqueReply — blocks false completion claims (propose-only invariant)", () => {
  for (const reply of [
    "I've placed your order!",
    "I placed the order for you.",
    "Your order has been placed.",
    "I've charged your card $48.",
    "Payment was processed — you're all set.",
    "I've processed your refund.",
    "I ordered the medium for you.",
    "All set — I've set that up for you.",
    "Your exchange has been confirmed.",
  ]) {
    it(`blocks: "${reply}"`, () => {
      expect(critiqueReply(reply, brand).ok).toBe(false);
    });
  }
});

describe("critiqueReply — allows compliant propose/ask phrasing", () => {
  for (const reply of [
    "Want me to set up an exchange? Reply YES to confirm.",
    "I can place that order once you confirm — reply YES and nothing's charged until then.",
    "Your order #1234 shipped Tuesday via UPS.",
    "Thanks for being a customer! How can I help?",
    "Reply YES and I'll get that exchange started — I won't make changes until you do.",
    "The rain jacket is in stock at $98. Want me to help you grab one?",
  ]) {
    it(`allows: "${reply}"`, () => {
      expect(critiqueReply(reply, brand).ok).toBe(true);
    });
  }
});

describe("critiqueReply — never offers an invented promo code", () => {
  it("blocks an offered code", () => {
    expect(critiqueReply("Use code SAVE20 for 10% off!", brand).ok).toBe(false);
    expect(critiqueReply("Your discount code is TAKE15.", brand).ok).toBe(false);
  });
  it("allows declining a promo (no code token)", () => {
    expect(critiqueReply("We don't have a promo code running right now.", brand).ok).toBe(true);
  });
});

describe("critiqueReply — enforces brand banned phrases", () => {
  it("blocks a banned phrase", () => {
    const c = critiqueReply("This jacket is a real game-changer.", brand);
    expect(c.ok).toBe(false);
    expect(c.violations.join(" ")).toMatch(/banned phrase/);
  });
});
