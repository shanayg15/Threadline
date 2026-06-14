import { getActiveBrand } from "@/lib/auth/brand";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import * as customers from "@/lib/db/repos/customers";

import { CustomersTable, type CustomerRow } from "./customers-table";

export const metadata = { title: "Customers — Threadline" };
export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const { brandId } = await getActiveBrand();
  const withStats = await customers.listWithStats(brandId);

  // Serialize Dates to ISO strings — the client table can't reliably receive Date
  // instances across the server/client boundary, so we format them in the cells.
  const rows: CustomerRow[] = withStats.map(
    ({ customer, orderCount, lastContactAt, conversationId }) => ({
      id: customer.id,
      name: customer.name,
      phoneE164: customer.phoneE164,
      consentStatus: customer.consentStatus,
      experimentGroup: customer.experimentGroup,
      orderCount,
      lastContactAt: lastContactAt ? lastContactAt.toISOString() : null,
      createdAt: customer.createdAt.toISOString(),
      conversationId,
    }),
  );

  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader title="Customers" description="Everyone you can reach, with consent state." />
        <CustomersTable rows={rows} />
      </div>
    </PageContainer>
  );
}
