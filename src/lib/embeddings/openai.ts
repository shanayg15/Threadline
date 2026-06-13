import type { Embedder } from "./types";

/**
 * OpenAI embeddings (default; EMBEDDINGS_PROVIDER=openai). Fetch-based — no SDK
 * dependency. Batches up to ~2048 inputs per request. Requires OPENAI_API_KEY.
 */
export class OpenAIEmbedder implements Embedder {
  readonly model: string;
  readonly dimensions: number;
  private readonly apiKey: string;

  constructor(opts: { apiKey: string; model: string; dimensions: number }) {
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.dimensions = opts.dimensions;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts, dimensions: this.dimensions }),
    });

    if (!res.ok) {
      // Never log the body verbatim (could echo input); surface status only.
      throw new Error(`OpenAI embeddings failed: HTTP ${res.status}`);
    }

    const json = (await res.json()) as { data: Array<{ index: number; embedding: number[] }> };
    // Preserve input order (API returns objects with an index).
    const ordered = [...json.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
    for (const v of ordered) {
      if (v.length !== this.dimensions) {
        throw new Error(`OpenAI returned dim ${v.length}, expected ${this.dimensions}`);
      }
    }
    return ordered;
  }
}
