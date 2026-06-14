import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { consentLog, type consentAction } from "@/lib/db/schema";
import { one } from "./_util";

export type ConsentEntry = typeof consentLog.$inferSelect;

type ConsentActionType = (typeof consentAction.enumValues)[number];

/**
 * APPEND-ONLY. Exposes only record/read — never update or delete. You may need to
 * prove consent and opt-out timing, so every opt-in/opt-out/help/start is logged.
 */
export async function record(
  brandId: string,
  entry: {
    action: ConsentActionType;
    customerId?: string | null;
    source?: string;
    rawMessage?: string;
  },
): Promise<ConsentEntry> {
  return one(
    await db
      .insert(consentLog)
      .values({ ...entry, brandId })
      .returning(),
  );
}

export async function listForCustomer(
  brandId: string,
  customerId: string,
): Promise<ConsentEntry[]> {
  return db
    .select()
    .from(consentLog)
    .where(and(eq(consentLog.brandId, brandId), eq(consentLog.customerId, customerId)))
    .orderBy(desc(consentLog.createdAt));
}

/** Brand-wide consent log (newest first) — the Settings opt-out/consent audit view. */
export async function listForBrand(
  brandId: string,
  opts: { action?: ConsentActionType; limit?: number } = {},
): Promise<ConsentEntry[]> {
  const where = opts.action
    ? and(eq(consentLog.brandId, brandId), eq(consentLog.action, opts.action))
    : eq(consentLog.brandId, brandId);
  return db
    .select()
    .from(consentLog)
    .where(where)
    .orderBy(desc(consentLog.createdAt))
    .limit(opts.limit ?? 100);
}
