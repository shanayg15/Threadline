import type { Embedder } from "./types";

/**
 * Deterministic, keyless embedder for dev and tests (EMBEDDINGS_PROVIDER=local).
 * Uses signed feature hashing over word tokens + L2 normalization, so texts that
 * share vocabulary land closer in cosine space — enough to exercise the full
 * embed → store → hybrid-search pipeline without an external API. NOT for prod
 * relevance quality; use OpenAI/Voyage there.
 */
export class LocalEmbedder implements Embedder {
  readonly model = "local-feature-hash";
  readonly dimensions: number;

  constructor(dimensions: number) {
    this.dimensions = dimensions;
  }

  embed(texts: string[]): Promise<number[][]> {
    return Promise.resolve(texts.map((t) => this.embedOne(t)));
  }

  private embedOne(text: string): number[] {
    const dim = this.dimensions;
    const vec = new Array<number>(dim).fill(0);
    const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    for (const token of tokens) {
      const h1 = fnv1a(token);
      const h2 = fnv1a(`${token}#salt`);
      vec[h1 % dim]! += h1 & 1 ? 1 : -1;
      vec[h2 % dim]! += h2 & 1 ? 1 : -1;
    }
    let norm = 0;
    for (const x of vec) norm += x * x;
    norm = Math.sqrt(norm) || 1;
    return vec.map((x) => x / norm);
  }
}

/** 32-bit FNV-1a hash → unsigned int. */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
