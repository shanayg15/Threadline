import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { brands } from "@/lib/db/schema";
import { one } from "./_util";

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;

/** The brands table IS the tenant, so it is keyed by id rather than brandId. */
export async function getById(brandId: string): Promise<Brand | undefined> {
  const rows = await db.select().from(brands).where(eq(brands.id, brandId)).limit(1);
  return rows[0];
}

export async function getBySlug(slug: string): Promise<Brand | undefined> {
  const rows = await db.select().from(brands).where(eq(brands.slug, slug)).limit(1);
  return rows[0];
}

export async function create(data: NewBrand): Promise<Brand> {
  return one(await db.insert(brands).values(data).returning());
}
