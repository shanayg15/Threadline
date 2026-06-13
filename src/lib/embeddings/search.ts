import { and, eq, ilike, or } from "drizzle-orm";

import type { CatalogHit } from "@/lib/commerce/types";
import { db } from "@/lib/db/client";
import * as knowledge from "@/lib/db/repos/knowledge";
import { products } from "@/lib/db/schema";
import { getEmbedder } from "./index";

function snippet(content: string, max = 160): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

/**
 * Hybrid catalog/policy retrieval: pgvector cosine KNN (semantic) merged with a
 * keyword ILIKE on product titles. RAG is for FINDING relevant products/policies —
 * it is NOT the source of stock/price (use getVariantLive for that).
 */
export async function searchCatalog(
  brandId: string,
  query: string,
  opts: { limit?: number } = {},
): Promise<CatalogHit[]> {
  const limit = opts.limit ?? 5;
  const embedder = getEmbedder();
  const [queryVec] = await embedder.embed([query]);

  const vectorHits = queryVec
    ? await knowledge.search(brandId, queryVec, { limit: limit * 2 })
    : [];

  const tokens = (query.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 2);
  const keywordRows =
    tokens.length > 0
      ? await db
          .select({ id: products.id, title: products.title })
          .from(products)
          .where(
            and(
              eq(products.brandId, brandId),
              or(...tokens.map((t) => ilike(products.title, `%${t}%`))),
            ),
          )
          .limit(limit)
      : [];

  const hits: CatalogHit[] = [];
  const seenProducts = new Set<string>();

  for (const v of vectorHits) {
    if (v.sourceType === "policy") {
      const section = typeof v.metadata?.section === "string" ? v.metadata.section : "Policy";
      hits.push({
        productId: null,
        variantId: null,
        title: `${section} policy`,
        sourceType: "policy",
        snippet: snippet(v.content),
        distance: Number(v.distance),
      });
      continue;
    }
    const pid = v.refId;
    if (pid && seenProducts.has(pid)) continue;
    if (pid) seenProducts.add(pid);
    hits.push({
      productId: pid,
      variantId: null,
      title: typeof v.metadata?.title === "string" ? v.metadata.title : snippet(v.content, 60),
      sourceType: "catalog",
      snippet: snippet(v.content),
      distance: Number(v.distance),
    });
  }

  for (const row of keywordRows) {
    if (seenProducts.has(row.id)) continue;
    seenProducts.add(row.id);
    hits.push({
      productId: row.id,
      variantId: null,
      title: row.title,
      sourceType: "catalog",
      snippet: row.title,
      distance: null,
    });
  }

  return hits.slice(0, limit);
}
