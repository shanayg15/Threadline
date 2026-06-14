import { sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { brands } from "@/lib/db/schema";

export type Brand = typeof brands.$inferSelect;

/**
 * Resolve the brand that owns an inbound `to` number. The brand's sending number
 * is stored (non-secret) in channelConfig.phoneNumber. FAILS CLOSED when the number
 * is unknown or ambiguous (maps to 0 or >1 brands) — we never guess a tenant.
 */
export async function resolveBrandByNumber(toNumber: string): Promise<Brand | null> {
  const rows = await db
    .select()
    .from(brands)
    .where(sql`${brands.channelConfig}->>'phoneNumber' = ${toNumber}`)
    .limit(2);
  if (rows.length !== 1) return null;
  return rows[0]!;
}
