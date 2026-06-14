import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { playbooks } from "@/lib/db/schema";

export type Playbook = typeof playbooks.$inferSelect;

export async function list(brandId: string): Promise<Playbook[]> {
  return db
    .select()
    .from(playbooks)
    .where(eq(playbooks.brandId, brandId))
    .orderBy(asc(playbooks.key));
}

export async function setEnabled(
  brandId: string,
  id: string,
  enabled: boolean,
): Promise<Playbook | undefined> {
  const rows = await db
    .update(playbooks)
    .set({ enabled })
    .where(and(eq(playbooks.brandId, brandId), eq(playbooks.id, id)))
    .returning();
  return rows[0];
}
