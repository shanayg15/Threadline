import { getActiveBrand } from "@/lib/auth/brand";
import * as products from "@/lib/db/repos/products";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";

import { ProductsClient, type ProductRow } from "./products-client";

export const metadata = { title: "Products — Threadline" };
export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const { brandId, role } = await getActiveBrand();
  const rows = await products.listWithVariants(brandId);

  // Serialize to a plain, client-safe shape (Dates → ISO strings).
  const data: ProductRow[] = rows.map(({ product, variants }) => ({
    id: product.id,
    title: product.title,
    description: product.description,
    fitNotes: product.fitNotes,
    status: product.status,
    updatedAt: product.updatedAt.toISOString(),
    variants: variants.map((v) => ({
      id: v.id,
      title: v.title,
      sku: v.sku,
      priceCents: v.priceCents,
      inventoryQty: v.inventoryQty,
      options: v.options,
    })),
  }));

  return (
    <PageContainer>
      <PageHeader title="Products" description="Edit fit notes to sharpen the agent's answers." />
      <div className="mt-6">
        <ProductsClient data={data} canEdit={role !== "viewer"} />
      </div>
    </PageContainer>
  );
}
