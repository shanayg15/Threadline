import { and, cosineDistance, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { knowledgeChunks, type knowledgeSourceType } from "@/lib/db/schema";
import { one } from "./_util";

export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;

type SourceType = (typeof knowledgeSourceType.enumValues)[number];

export async function insert(
  brandId: string,
  data: {
    sourceType: SourceType;
    content: string;
    embedding: number[];
    refId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<KnowledgeChunk> {
  return one(
    await db
      .insert(knowledgeChunks)
      .values({ ...data, brandId })
      .returning(),
  );
}

/**
 * Cosine-distance KNN over a brand's knowledge chunks (`embedding <=> $query`).
 * Lower distance = closer. The HNSW index makes this fast.
 */
export async function search(
  brandId: string,
  embedding: number[],
  opts: { sourceType?: SourceType; limit?: number } = {},
) {
  const distance = cosineDistance(knowledgeChunks.embedding, embedding);
  const where = opts.sourceType
    ? and(eq(knowledgeChunks.brandId, brandId), eq(knowledgeChunks.sourceType, opts.sourceType))
    : eq(knowledgeChunks.brandId, brandId);

  return db
    .select({
      id: knowledgeChunks.id,
      sourceType: knowledgeChunks.sourceType,
      refId: knowledgeChunks.refId,
      content: knowledgeChunks.content,
      metadata: knowledgeChunks.metadata,
      distance,
    })
    .from(knowledgeChunks)
    .where(where)
    .orderBy(distance)
    .limit(opts.limit ?? 5);
}

/** Remove a brand's chunks (optionally just one sourceType) before re-embedding. */
export async function deleteByBrand(brandId: string, sourceType?: SourceType): Promise<void> {
  const where = sourceType
    ? and(eq(knowledgeChunks.brandId, brandId), eq(knowledgeChunks.sourceType, sourceType))
    : eq(knowledgeChunks.brandId, brandId);
  await db.delete(knowledgeChunks).where(where);
}
