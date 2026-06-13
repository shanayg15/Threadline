import { pool } from "@/lib/db/client";
import { getCommerceProvider } from "./index";

/**
 * Initial full sync for a brand:  pnpm tsx src/lib/commerce/sync-cli.ts <brandId>
 *
 * Uses the real Shopify provider when credentials are configured, else the mock
 * provider. Designed to be callable from BullMQ for the nightly re-sync (M8).
 */
async function main() {
  const brandId = process.argv[2];
  if (!brandId) {
    console.error("usage: pnpm tsx src/lib/commerce/sync-cli.ts <brandId>");
    process.exit(1);
  }

  const provider = await getCommerceProvider(brandId);
  console.log(`Syncing brand ${brandId} via ${provider.constructor.name}…`);

  const catalog = await provider.syncCatalog(brandId);
  console.log(`  catalog:   ${catalog.products} products, ${catalog.variants} variants`);
  const customers = await provider.syncCustomers(brandId);
  console.log(`  customers: ${customers} (with phone)`);
  const orders = await provider.syncOrders(brandId);
  console.log(`  orders:    ${orders}`);

  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("sync failed:", err instanceof Error ? err.message : err);
  await pool.end();
  process.exit(1);
});
