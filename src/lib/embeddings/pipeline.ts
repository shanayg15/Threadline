import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import * as brands from "@/lib/db/repos/brands";
import * as products from "@/lib/db/repos/products";
import { knowledgeChunks } from "@/lib/db/schema";
import { getEmbedder } from "./index";

type ChunkSpec = {
  sourceType: "catalog" | "policy";
  content: string;
  refId: string | null;
  metadata: Record<string, unknown>;
};

function summarizeVariants(
  variants: Array<{ priceCents: number | null; options: Record<string, string> | null }>,
): { options: string; price: string } {
  const colors = new Set<string>();
  const sizes = new Set<string>();
  for (const v of variants) {
    if (v.options?.color) colors.add(v.options.color);
    if (v.options?.size) sizes.add(v.options.size);
  }
  const prices = variants.map((v) => v.priceCents).filter((c): c is number => c != null);
  const price =
    prices.length === 0
      ? ""
      : (() => {
          const min = Math.min(...prices);
          const max = Math.max(...prices);
          const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
          return min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`;
        })();
  const parts: string[] = [];
  if (colors.size) parts.push(`Colors: ${[...colors].join(", ")}`);
  if (sizes.size) parts.push(`Sizes: ${[...sizes].join(", ")}`);
  return { options: parts.join("; "), price };
}

/**
 * Build the brand's knowledge base in pgvector: one chunk per product (title,
 * description, fit notes, options, price) and one per policy section. Embeddings
 * are batched, then the brand's chunks are replaced atomically so re-running
 * updates without duplicating and drops entities that no longer exist.
 */
export async function embedBrandKnowledge(
  brandId: string,
): Promise<{ catalog: number; policy: number }> {
  const brand = await brands.getById(brandId);
  if (!brand) throw new Error(`brand ${brandId} not found`);

  const embedder = getEmbedder();
  const specs: ChunkSpec[] = [];

  for (const product of await products.list(brandId)) {
    const variants = await products.listVariants(brandId, product.id);
    const { options, price } = summarizeVariants(variants);
    const content = [
      product.title,
      product.description ?? "",
      product.fitNotes ? `Fit notes: ${product.fitNotes}` : "",
      options,
      price ? `Price: ${price}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    specs.push({
      sourceType: "catalog",
      content,
      refId: product.id,
      metadata: { productId: product.id, title: product.title },
    });
  }

  if (brand.policies) {
    for (const [section, text] of Object.entries(brand.policies)) {
      if (typeof text === "string" && text.trim()) {
        specs.push({
          sourceType: "policy",
          content: `${section[0]!.toUpperCase()}${section.slice(1)} policy: ${text}`,
          refId: null,
          metadata: { section },
        });
      }
    }
  }

  const embeddings = await embedder.embed(specs.map((s) => s.content));
  const rows = specs.map((s, i) => ({
    brandId,
    sourceType: s.sourceType,
    content: s.content,
    embedding: embeddings[i]!,
    refId: s.refId,
    metadata: s.metadata,
  }));

  await db.transaction(async (tx) => {
    await tx.delete(knowledgeChunks).where(eq(knowledgeChunks.brandId, brandId));
    if (rows.length > 0) await tx.insert(knowledgeChunks).values(rows);
  });

  return {
    catalog: specs.filter((s) => s.sourceType === "catalog").length,
    policy: specs.filter((s) => s.sourceType === "policy").length,
  };
}
