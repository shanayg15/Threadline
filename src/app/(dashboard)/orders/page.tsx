import { ShoppingBag } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Orders — Threadline" };

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Orders" description="Synced from Shopify, tied to conversations." />
      <EmptyState
        icon={ShoppingBag}
        title="The orders table arrives in M7"
        description="Order status, fulfillment, tracking, and the attributed conversation — populated by the M4 Shopify sync."
      />
    </div>
  );
}
