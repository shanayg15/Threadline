import { describe, expect, it } from "vitest";

import { attributionCodeFor } from "./attribution";
import { assignGroup } from "./groups";

describe("assignGroup — deterministic stable bucketing", () => {
  it("returns the same arm for the same seed (reproducible)", () => {
    for (const seed of ["brand-1:+15555550100", "brand-2:+15555550101", "x", ""]) {
      expect(assignGroup(seed)).toBe(assignGroup(seed));
    }
  });

  it("treatmentRatio 1 => always treatment", () => {
    for (let i = 0; i < 1000; i++) {
      expect(assignGroup(`seed-${i}`, 1)).toBe("treatment");
    }
  });

  it("treatmentRatio 0 => always control", () => {
    for (let i = 0; i < 1000; i++) {
      expect(assignGroup(`seed-${i}`, 0)).toBe("control");
    }
  });

  it("spreads different seeds across both arms (~80/20 over 1000 samples)", () => {
    let treatment = 0;
    let control = 0;
    for (let i = 0; i < 1000; i++) {
      if (assignGroup(`customer-${i}`) === "treatment") treatment++;
      else control++;
    }
    // Both arms must be populated; with a 0.8 ratio neither should be empty.
    expect(treatment).toBeGreaterThan(0);
    expect(control).toBeGreaterThan(0);
    // Sanity: the split should lean toward treatment, roughly in the ratio direction.
    expect(treatment).toBeGreaterThan(control);
  });
});

describe("attributionCodeFor — deterministic uppercase code", () => {
  it("is stable for the same conversation id", () => {
    expect(attributionCodeFor("conv-123")).toBe(attributionCodeFor("conv-123"));
  });

  it("is uppercase and prefixed with TL", () => {
    const code = attributionCodeFor("conv-abc");
    expect(code).toBe(code.toUpperCase());
    expect(code.startsWith("TL")).toBe(true);
    // "TL" + 8 hex chars.
    expect(code).toHaveLength(10);
    expect(code).toMatch(/^TL[0-9A-F]{8}$/);
  });

  it("differs for different conversation ids", () => {
    expect(attributionCodeFor("conv-a")).not.toBe(attributionCodeFor("conv-b"));
  });
});
