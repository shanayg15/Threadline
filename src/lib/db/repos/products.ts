import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { productVariants, products } from "@/lib/db/schema";
import { one } from "./_util";

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;

export async function list(brandId: string): Promise<Product[]> {
  return db.select().from(products).where(eq(products.brandId, brandId));
}

export async function getById(brandId: string, id: string): Promise<Product | undefined> {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.brandId, brandId), eq(products.id, id)))
    .limit(1);
  return rows[0];
}

export async function listVariants(brandId: string, productId: string): Promise<ProductVariant[]> {
  return db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.brandId, brandId), eq(productVariants.productId, productId)));
}

/** Create a product together with its variants (brandId stamped on both). */
export async function createWithVariants(
  brandId: string,
  product: Omit<NewProduct, "brandId" | "id">,
  variants: Array<Omit<NewProductVariant, "brandId" | "productId" | "id">>,
): Promise<Product> {
  return db.transaction(async (tx) => {
    const created = one(
      await tx
        .insert(products)
        .values({ ...product, brandId })
        .returning(),
    );
    if (variants.length > 0) {
      await tx
        .insert(productVariants)
        .values(variants.map((v) => ({ ...v, brandId, productId: created.id })));
    }
    return created;
  });
}
