import { describe, expect, it } from "vitest";

import { LocalEmbedder } from "./local";

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

describe("LocalEmbedder", () => {
  const embedder = new LocalEmbedder(1536);

  it("produces vectors of the configured dimension", async () => {
    const [v] = await embedder.embed(["hello world"]);
    expect(v!.length).toBe(1536);
  });

  it("is L2-normalized", async () => {
    const [v] = await embedder.embed(["a green trail jacket"]);
    const norm = Math.sqrt(v!.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("is deterministic", async () => {
    const [a] = await embedder.embed(["a green trail jacket"]);
    const [b] = await embedder.embed(["a green trail jacket"]);
    expect(a).toEqual(b);
  });

  it("places semantically-related texts closer than unrelated ones", async () => {
    const [q] = await embedder.embed(["jacket for layering"]);
    const [near] = await embedder.embed(["a layering jacket for cold weather"]);
    const [far] = await embedder.embed(["ceramic dinner plates and bowls"]);
    expect(cosine(q!, near!)).toBeGreaterThan(cosine(q!, far!));
  });
});
