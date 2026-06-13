import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { one } from "./_util";

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * Auth bootstrap lookup. Email is globally unique, so login finds the user (and
 * thereby DISCOVERS their brand) by email — this is the one repo read that is not
 * brand-scoped first, by necessity. Everything downstream uses the resolved brandId.
 */
export async function getByEmail(email: string): Promise<User | undefined> {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0];
}

export async function getById(brandId: string, id: string): Promise<User | undefined> {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.brandId, brandId), eq(users.id, id)))
    .limit(1);
  return rows[0];
}

export async function listForBrand(brandId: string): Promise<User[]> {
  return db.select().from(users).where(eq(users.brandId, brandId));
}

export async function create(
  brandId: string,
  data: Omit<NewUser, "brandId" | "id">,
): Promise<User> {
  return one(
    await db
      .insert(users)
      .values({ ...data, brandId })
      .returning(),
  );
}
