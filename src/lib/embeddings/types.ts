/**
 * Embedder interface — turns text into vectors for pgvector RAG. Implementations:
 * OpenAIEmbedder (default), VoyageEmbedder (stub), LocalEmbedder (deterministic,
 * keyless — for dev/tests). Selected by EMBEDDINGS_PROVIDER.
 *
 * Every implementation MUST return vectors of exactly `dimensions` length, equal
 * to env.EMBEDDING_DIM and the `vector()` column dimension from M2.
 */
export interface Embedder {
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}
