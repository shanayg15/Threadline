import { getActiveBrand } from "@/lib/auth/brand";
import * as orders from "@/lib/db/repos/orders";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";

import { OrdersTable, type OrderRow } from "./orders-table";

export const metadata = { title: "Orders — Threadline" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { brandId } = await getActiveBrand();
  const rows = await orders.listWithCustomer(brandId);

  const data: OrderRow[] = rows.map((o) => ({
    id: o.id,
    shopifyOrderId: o.shopifyOrderId,
    customerName: o.customerName,
    phoneE164: o.phoneE164,
    status: o.status,
    totalCents: o.totalCents,
    fulfillmentStatus: o.fulfillmentStatus,
    trackingNumber: o.trackingNumber,
    carrier: o.carrier,
    shippedAt: o.shippedAt ? o.shippedAt.toISOString() : null,
    deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : null,
    attributedConversationId: o.attributedConversationId,
    createdAt: o.createdAt.toISOString(),
  }));

  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader
          title="Orders"
          description="Synced from Shopify, tied to conversations. Attribution is populated in M8."
        />
        <OrdersTable data={data} />
      </div>
    </PageContainer>
  );
}
