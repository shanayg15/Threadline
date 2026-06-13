import { Users } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Customers — Threadline" };

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Everyone you can reach, with consent state." />
      <EmptyState
        icon={Users}
        title="The customers table arrives in M7"
        description="Name, phone, consent status, experiment group, order count, and last contact — synced from Shopify in M4."
      />
    </div>
  );
}
