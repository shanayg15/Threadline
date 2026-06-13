import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { auditLog, type auditActor } from "@/lib/db/schema";
import { one } from "./_util";

export type AuditEntry = typeof auditLog.$inferSelect;

type Actor = (typeof auditActor.enumValues)[number];

/**
 * APPEND-ONLY. This repo intentionally exposes only record/read — never update or
 * delete. Every AI decision, tool call, outbound message, and human takeover is
 * recorded here for debugging, disputes, and compliance.
 */
export async function record(
  brandId: string,
  entry: {
    actor: Actor;
    action: string;
    actorUserId?: string | null;
    targetType?: string;
    targetId?: string;
    payload?: Record<string, unknown>;
  },
): Promise<AuditEntry> {
  return one(
    await db
      .insert(auditLog)
      .values({ ...entry, brandId })
      .returning(),
  );
}

export async function list(brandId: string, opts: { limit?: number } = {}): Promise<AuditEntry[]> {
  return db
    .select()
    .from(auditLog)
    .where(eq(auditLog.brandId, brandId))
    .orderBy(desc(auditLog.createdAt))
    .limit(opts.limit ?? 100);
}

export async function listForTarget(
  brandId: string,
  targetType: string,
  targetId: string,
): Promise<AuditEntry[]> {
  return db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.brandId, brandId),
        eq(auditLog.targetType, targetType),
        eq(auditLog.targetId, targetId),
      ),
    )
    .orderBy(desc(auditLog.createdAt));
}
