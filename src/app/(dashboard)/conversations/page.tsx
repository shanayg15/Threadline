import { MessageSquare } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Conversations — Threadline" };

export default function ConversationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Conversations" description="Every customer thread, in one place." />
      <EmptyState
        icon={MessageSquare}
        title="The conversations console arrives in M7"
        description="A filterable list plus a three-pane thread view — iMessage-style bubbles, the customer panel, AI⇄Human handoff, supervised approvals, and Pause."
      />
    </div>
  );
}
