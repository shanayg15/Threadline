import { MessageSquare } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <PageHeader title="Conversation" description={`Thread ${id}`} />
      <EmptyState
        icon={MessageSquare}
        title="The thread view arrives in M7"
        description="Message history, customer + order context, the composer, and the supervised Approve / Edit / Reject bar will live here."
      />
    </div>
  );
}
