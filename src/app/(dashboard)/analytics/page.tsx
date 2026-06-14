import { getActiveBrand } from "@/lib/auth/brand";
import * as analytics from "@/lib/db/repos/analytics";
import { formatUsdFromCents } from "@/lib/format";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Analytics — Threadline" };
export const dynamic = "force-dynamic";

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

const STATUS_LABELS: Record<keyof analytics.BrandSummary["conversationsByStatus"], string> = {
  automated: "Automated",
  escalated: "Escalated",
  blocked: "Blocked",
  closed: "Closed",
};

export default async function AnalyticsPage() {
  const { brandId } = await getActiveBrand();
  const summary = await analytics.brandSummary(brandId);

  const engagementPct = `${(summary.engagementRate * 100).toFixed(1)}%`;
  const statusEntries = (Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map(
    (key) => ({
      key,
      label: STATUS_LABELS[key],
      count: summary.conversationsByStatus[key],
    }),
  );

  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader
          title="Analytics"
          description="Engagement and revenue measurement. Attribution is assist-based for V1 — honest numbers, no inflated lift claims."
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Metric label="Total conversations" value={summary.totalConversations.toLocaleString()} />
          <Metric
            label="Engagement rate"
            value={engagementPct}
            hint={`${summary.engagedConversations.toLocaleString()} of ${summary.totalConversations.toLocaleString()} threads got a customer reply`}
          />
          <Metric
            label="Attributed orders"
            value={summary.attributedOrders.toLocaleString()}
            hint="Orders a thread touched (assist-based, V1)"
          />
          <Metric
            label="Attributed revenue"
            value={formatUsdFromCents(summary.attributedRevenueCents)}
            hint="Assist-based (V1) — not incremental lift"
          />
          <Metric
            label="Agent cost"
            value={formatUsdFromCents(summary.agentCostCents)}
            hint="Outbound AI message spend"
          />
          <Metric
            label="Treatment vs holdout"
            value={`${summary.treatmentCount.toLocaleString()} / ${summary.controlCount.toLocaleString()}`}
            hint={`${summary.unassignedCount.toLocaleString()} unassigned · cohort sizes only`}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversations by status</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Conversations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statusEntries.map((entry) => (
                  <TableRow key={entry.key}>
                    <TableCell>{entry.label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {entry.count.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-medium">Total</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {summary.totalConversations.toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Treatment and holdout are shown as plain cohort counts. Incremental lift (the causal
          impact of the agent) requires comparing outcomes between these groups and is not reported
          here — that comparison lands in Phase 3.
        </p>
      </div>
    </PageContainer>
  );
}
