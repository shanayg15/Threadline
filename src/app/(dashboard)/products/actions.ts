"use server";

import { revalidatePath } from "next/cache";

import { getActiveBrand } from "@/lib/auth/brand";
import * as audit from "@/lib/db/repos/audit";
import * as products from "@/lib/db/repos/products";
import { embedBrandKnowledge } from "@/lib/embeddings/pipeline";

export async function updateFitNotesAction(
  productId: string,
  fitNotes: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { brandId, userId, role } = await getActiveBrand();
  if (role === "viewer") return { ok: false, error: "You don't have permission." };

  await products.updateFitNotes(brandId, productId, fitNotes.trim() || null);
  // Re-embed so the agent's catalog knowledge reflects the edit (whole-brand
  // rebuild — the only entrypoint).
  await embedBrandKnowledge(brandId);
  await audit.record(brandId, {
    actor: "human",
    actorUserId: userId,
    action: "product_fit_notes_updated",
    targetType: "product",
    targetId: productId,
  });
  revalidatePath("/products");
  return { ok: true };
}
