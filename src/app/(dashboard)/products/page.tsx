import { Box } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Products — Threadline" };

export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Your catalog and the fit notes that ground answers."
      />
      <EmptyState
        icon={Box}
        title="The products table arrives in M7"
        description="Catalog rows with editable fit notes / agent metadata — the detail that makes the concierge's answers good. Synced in M4."
      />
    </div>
  );
}
