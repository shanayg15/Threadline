import type { Embedder } from "./types";

/**
 * Voyage AI embeddings — stub for V1. The interface is here so EMBEDDINGS_PROVIDER
 * can select it later; wiring the real `/v1/embeddings` call (and confirming the
 * model's dimension matches EMBEDDING_DIM) is a follow-up.
 */
export class VoyageEmbedder implements Embedder {
  readonly model: string;
  readonly dimensions: number;

  constructor(opts: { model: string; dimensions: number }) {
    this.model = opts.model;
    this.dimensions = opts.dimensions;
  }

  embed(texts: string[]): Promise<number[][]> {
    throw new Error(
      `VoyageEmbedder is not implemented in V1 (received ${texts.length} texts). ` +
        "Set EMBEDDINGS_PROVIDER=openai or =local.",
    );
  }
}
