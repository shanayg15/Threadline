import { BarChart3 } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Analytics — Threadline" };

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Engagement, revenue, and honest lift." />
      <EmptyState
        icon={BarChart3}
        title="Analytics arrive in M8"
        description="Conversation volume, engagement rate, support/sales mix, attributed revenue, and incremental lift vs holdout."
      />
    </div>
  );
}
