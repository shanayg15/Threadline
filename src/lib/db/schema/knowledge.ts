import { index, jsonb, pgTable, text, uuid, vector } from "drizzle-orm/pg-core";

import { createdAt, uuidPk } from "./_shared";
import { brands } from "./brands";
import { knowledgeSourceType } from "./enums";
// Relative import (not @/...) so drizzle-kit can bundle this for migrations.
import { env } from "../../config/env";

/**
 * `knowledgeChunks` — pgvector RAG store over catalog + policy text (embedded in
 * M4). The embedding dimension MUST equal env.EMBEDDING_DIM; changing the embedder
 * later means a migration + re-embed. The HNSW index uses cosine distance, queried
 * with the `<=>` operator.
 */
export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: uuidPk(),
    brandId: uuid()
      .notNull()
      .references(() => brands.id),
    sourceType: knowledgeSourceType().notNull(),
    // Nullable reference to the source product/variant id (polymorphic, no FK).
    refId: uuid(),
    content: text().notNull(),
    embedding: vector({ dimensions: env.EMBEDDING_DIM }),
    metadata: jsonb().$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index("knowledge_chunks_embedding_hnsw").using("hnsw", t.embedding.op("vector_cosine_ops")),
    index("knowledge_chunks_brand_source_idx").on(t.brandId, t.sourceType),
  ],
);
