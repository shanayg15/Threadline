import { describe, expect, it } from "vitest";

import {
  classifyKeyword,
  helpText,
  normalizeFirstWord,
  optOutConfirmation,
  resumeConfirmation,
} from "./keywords";

describe("classifyKeyword — opt-out (STOP wins, case/whitespace/punctuation tolerant)", () => {
  for (const body of [
    "STOP",
    "stop",
    "  STOP  ",
    "Stop.",
    "STOP please",
    "stop!",
    "UNSUBSCRIBE",
    "Cancel",
    "END",
    "quit",
    "STOPALL",
    "optout",
    "revoke",
  ]) {
    it(`"${body}" -> opt_out`, () => {
      expect(classifyKeyword(body)).toBe("opt_out");
    });
  }
});

describe("classifyKeyword — help", () => {
  for (const body of ["HELP", "help", "INFO", "Help me"]) {
    it(`"${body}" -> help`, () => {
      expect(classifyKeyword(body)).toBe("help");
    });
  }
});

describe("classifyKeyword — resume keyword (caller decides if it's a real resume)", () => {
  for (const body of ["START", "start", "YES", "unstop", "OPTIN"]) {
    it(`"${body}" -> resume`, () => {
      expect(classifyKeyword(body)).toBe("resume");
    });
  }
});

describe("classifyKeyword — NOT a keyword (no false opt-outs / substrings)", () => {
  for (const body of [
    "please don't stop texting me", // first word "please"
    "I want to stop by the store", // first word "i"
    "yesterday", // not "yes"
    "stopping by later", // not "stop"
    "starter kit please", // not "start"
    "does the jacket run true to size?",
    "",
    "   ",
  ]) {
    it(`"${body}" -> null`, () => {
      expect(classifyKeyword(body)).toBe(null);
    });
  }
});

describe("normalizeFirstWord", () => {
  it("trims, lowercases, strips surrounding punctuation, keeps the first word", () => {
    expect(normalizeFirstWord("  Stop.  please")).toBe("stop");
    expect(normalizeFirstWord("YES!")).toBe("yes");
    expect(normalizeFirstWord("")).toBe("");
  });
});

describe("canned responses", () => {
  const ctx = { brandName: "Demo Apparel Co", supportContact: "help@demo.test" };
  it("opt-out names the brand and offers START", () => {
    const r = optOutConfirmation(ctx);
    expect(r).toContain("Demo Apparel Co");
    expect(r).toMatch(/START/i);
  });
  it("help carries the required CTIA boilerplate", () => {
    const r = helpText(ctx);
    expect(r).toContain("Demo Apparel Co");
    expect(r).toContain("Msg&data rates may apply");
    expect(r).toMatch(/Reply STOP to unsubscribe/i);
    expect(r).toContain("help@demo.test");
  });
  it("resume confirms resubscribe", () => {
    expect(resumeConfirmation(ctx)).toMatch(/resubscribed/i);
  });
});
