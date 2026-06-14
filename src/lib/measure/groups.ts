import { createHash } from "node:crypto";

import { customers } from "@/lib/db/repos";

export type ExperimentGroup = "treatment" | "control";

/**
 * Deterministically bucket a seed into the treatment or control arm.
 *
 * Pure and reproducible: the same seed always yields the same arm. We hash the
 * seed with SHA-256, read the first 4 bytes as a uint32, and normalize it into
 * [0, 1). A bucket below `treatmentRatio` is treatment, otherwise control — so a
 * ratio of 1 is always treatment and 0 is always control.
 */
export function assignGroup(seed: string, treatmentRatio = 0.8): ExperimentGroup {
  const h = createHash("sha256").update(seed).digest();
  const uint32 = h.readUInt32BE(0);
  const bucket = uint32 / 0xffffffff;
  return bucket < treatmentRatio ? "treatment" : "control";
}

/**
 * Return the customer's experiment arm, assigning + persisting one on first sight.
 *
 * Idempotent: if the customer already has a group it is returned unchanged. The
 * arm is derived deterministically from `${brandId}:${phoneE164}` so a re-run (or
 * a parallel writer) lands on the same arm.
 */
export async function ensureExperimentGroup(
  brandId: string,
  customer: { id: string; phoneE164: string; experimentGroup: ExperimentGroup | null },
): Promise<ExperimentGroup> {
  if (customer.experimentGroup) return customer.experimentGroup;
  const group = assignGroup(`${brandId}:${customer.phoneE164}`);
  await customers.assignExperimentGroup(brandId, customer.id, group);
  return group;
}
