import { describe, expect, it } from "vitest";

import { canSendOutbound, evaluateInbound, type OutboundCtx } from "./index";

const BRAND = { brandName: "Demo Apparel Co", supportContact: "help@demo.test" };
const optedIn = { consentStatus: "opted_in" as const };
const optedOut = { consentStatus: "opted_out" as const };
const unknown = { consentStatus: "unknown" as const };

describe("evaluateInbound — opt-out", () => {
  for (const body of [
    "STOP",
    "stop",
    "  STOP  ",
    "Stop.",
    "STOP please",
    "UNSUBSCRIBE",
    "CANCEL",
    "END",
    "QUIT",
  ]) {
    it(`"${body}" -> opt_out with a confirmation reply`, () => {
      const d = evaluateInbound({ brand: BRAND, customer: optedIn, messageBody: body });
      expect(d.action).toBe("opt_out");
      if (d.action === "opt_out") expect(d.reply).toContain("Demo Apparel Co");
    });
  }
  it("STOP wins even when already opted out", () => {
    expect(evaluateInbound({ brand: BRAND, customer: optedOut, messageBody: "STOP" }).action).toBe(
      "opt_out",
    );
  });
});

describe("evaluateInbound — help (always answerable)", () => {
  for (const body of ["HELP", "help", "INFO"]) {
    it(`"${body}" -> help`, () => {
      const d = evaluateInbound({ brand: BRAND, customer: optedIn, messageBody: body });
      expect(d.action).toBe("help");
      if (d.action === "help") expect(d.reply).toMatch(/Reply STOP to unsubscribe/i);
    });
  }
  it("HELP is answered even when opted out", () => {
    expect(evaluateInbound({ brand: BRAND, customer: optedOut, messageBody: "HELP" }).action).toBe(
      "help",
    );
  });
});

describe("evaluateInbound — resume ONLY when opted out ('YES' precedence)", () => {
  for (const body of ["START", "YES", "UNSTOP", "OPTIN"]) {
    it(`"${body}" while opted_out -> resume`, () => {
      expect(evaluateInbound({ brand: BRAND, customer: optedOut, messageBody: body }).action).toBe(
        "resume",
      );
    });
    it(`"${body}" while opted_in -> proceed (reaches the agent/gate, not a compliance action)`, () => {
      expect(evaluateInbound({ brand: BRAND, customer: optedIn, messageBody: body }).action).toBe(
        "proceed",
      );
    });
  }
});

describe("evaluateInbound — blocked / proceed", () => {
  it("opted-out customer's normal message -> blocked (no reply, no agent)", () => {
    expect(
      evaluateInbound({ brand: BRAND, customer: optedOut, messageBody: "hey is this in stock?" })
        .action,
    ).toBe("blocked");
  });
  it("opted-in normal message -> proceed", () => {
    expect(
      evaluateInbound({
        brand: BRAND,
        customer: optedIn,
        messageBody: "does the jacket run small?",
      }).action,
    ).toBe("proceed");
  });
  it("unknown-consent inbound -> proceed (we may answer an inbound)", () => {
    expect(evaluateInbound({ brand: BRAND, customer: unknown, messageBody: "hi" }).action).toBe(
      "proceed",
    );
  });
});

// quiet hours 09:00–21:00 (sendable window); caps perDay 1 / perWeek 3
const outBrand = {
  quietHours: { start: "09:00", end: "21:00" },
  frequencyCaps: { perDay: 1, perWeek: 3 },
};
// 16:00Z = 12:00 in America/New_York (EDT) -> within window
const WITHIN = new Date("2026-06-15T16:00:00Z");
// 03:00Z = 23:00 previous day in NY (outside), 20:00 in LA (within)
const NIGHT_NY = new Date("2026-06-15T03:00:00Z");

function out(over: Partial<OutboundCtx>): OutboundCtx {
  return {
    brand: outBrand,
    customer: { consentStatus: "opted_in", timezone: "America/New_York" },
    now: WITHIN,
    recentOutbound: { day: 0, week: 0 },
    ...over,
  };
}

describe("canSendOutbound — consent, quiet hours, caps", () => {
  it("opted-in, within window, under caps -> allowed", () => {
    expect(canSendOutbound(out({})).allowed).toBe(true);
  });
  it("outside quiet hours -> blocked with a nextAllowedAt", () => {
    const d = canSendOutbound(out({ now: NIGHT_NY }));
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      expect(d.reason).toMatch(/quiet hours/);
      expect(d.nextAllowedAt).toBeInstanceOf(Date);
    }
  });
  it("over the daily cap -> blocked", () => {
    expect(canSendOutbound(out({ recentOutbound: { day: 1, week: 1 } })).allowed).toBe(false);
  });
  it("over the weekly cap -> blocked", () => {
    expect(canSendOutbound(out({ recentOutbound: { day: 0, week: 3 } })).allowed).toBe(false);
  });
  it("opted-out -> blocked", () => {
    expect(
      canSendOutbound(
        out({ customer: { consentStatus: "opted_out", timezone: "America/New_York" } }),
      ).allowed,
    ).toBe(false);
  });
  it("unknown consent (proactive) -> blocked (must be opted in)", () => {
    expect(
      canSendOutbound(out({ customer: { consentStatus: "unknown", timezone: "America/New_York" } }))
        .allowed,
    ).toBe(false);
  });
});

describe("canSendOutbound — timezone correctness (same UTC instant, different tz)", () => {
  it("23:00 in New York is blocked while 20:00 in Los Angeles is allowed", () => {
    const ny = canSendOutbound(
      out({ now: NIGHT_NY, customer: { consentStatus: "opted_in", timezone: "America/New_York" } }),
    );
    const la = canSendOutbound(
      out({
        now: NIGHT_NY,
        customer: { consentStatus: "opted_in", timezone: "America/Los_Angeles" },
      }),
    );
    expect(ny.allowed).toBe(false);
    expect(la.allowed).toBe(true);
  });
});

describe("canSendOutbound — inbound-reply exemption", () => {
  it("a reply is allowed even outside quiet hours and over caps", () => {
    expect(
      canSendOutbound(out({ now: NIGHT_NY, isReply: true, recentOutbound: { day: 99, week: 99 } }))
        .allowed,
    ).toBe(true);
  });
  it("but a reply to an opted-out number is still blocked (opt-out is absolute)", () => {
    expect(
      canSendOutbound(
        out({
          isReply: true,
          customer: { consentStatus: "opted_out", timezone: "America/New_York" },
        }),
      ).allowed,
    ).toBe(false);
  });
});
