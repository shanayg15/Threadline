import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { attributions } from "@/lib/db/schema";
import { one } from "./_util";

export type Attribution = typeof attributions.$inferSelect;
export type NewAttribution = typeof attributions.$inferInsert;

export async function record(
  brandId: string,
  data: Omit<NewAttribution, "brandId" | "id">,
): Promise<Attribution> {
  return one(
    await db
      .insert(attributions)
      .values({ ...data, brandId })
      .returning(),
  );
}

export async function listForConversation(
  brandId: string,
  conversationId: string,
): Promise<Attribution[]> {
  return db
    .select()
    .from(attributions)
    .where(and(eq(attributions.brandId, brandId), eq(attributions.conversationId, conversationId)));
}
