import { pool } from "@/lib/db/client";
import { getEmbedder } from "./index";
import { embedBrandKnowledge } from "./pipeline";

/**
 * Build/refresh a brand's knowledge base:
 *   pnpm tsx src/lib/embeddings/embed-cli.ts <brandId>
 *
 * Re-runnable — replaces the brand's chunks without duplicating.
 */
async function main() {
  const brandId = process.argv[2];
  if (!brandId) {
    console.error("usage: pnpm tsx src/lib/embeddings/embed-cli.ts <brandId>");
    process.exit(1);
  }

  const embedder = getEmbedder();
  console.log(`Embedding brand ${brandId} with ${embedder.model} (dim ${embedder.dimensions})…`);

  const result = await embedBrandKnowledge(brandId);
  console.log(`  ${result.catalog} catalog + ${result.policy} policy chunks`);

  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("embed failed:", err instanceof Error ? err.message : err);
  await pool.end();
  process.exit(1);
});
