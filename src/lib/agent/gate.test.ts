import { describe, expect, it } from "vitest";

import { classifyAffirmative } from "./gate";

// The confirmation gate must NOT execute on ambiguity. A naive includes('yes') mischarges
// intent — these are the cases the spec calls out explicitly.

describe("classifyAffirmative — CONFIRM (unambiguous yes)", () => {
  for (const t of ["yes", "Yes", "yeah", "yep", "yup", "sure", "ok", "okay", "do it", "confirm", "go ahead", "sounds good", "Yes please!", "absolutely"]) {
    it(`"${t}" -> confirm`, () => expect(classifyAffirmative(t)).toBe("confirm"));
  }
});

describe("classifyAffirmative — MODIFY (yes-but / change) re-confirms, never executes", () => {
  for (const t of [
    "yes but in navy",
    "actually make it the medium",
    "sure, but can you change the size",
    "yes, instead of blue do green",
    "do it but a different color",
    "I'd rather the large",
  ]) {
    it(`"${t}" -> modify`, () => expect(classifyAffirmative(t)).toBe("modify"));
  }
});

describe("classifyAffirmative — DECLINE", () => {
  for (const t of ["no", "nope", "nah", "no thanks", "cancel", "don't", "do not", "never mind", "not now", "forget it"]) {
    it(`"${t}" -> decline`, () => expect(classifyAffirmative(t)).toBe("decline"));
  }
});

describe("classifyAffirmative — UNCLEAR (questions / vague) never execute", () => {
  for (const t of ["maybe", "hmm", "what's the price again?", "how much is it?", "when would it ship?", "let me think", "", "👀", "idk"]) {
    it(`"${t}" -> unclear`, () => expect(classifyAffirmative(t)).toBe("unclear"));
  }
});
