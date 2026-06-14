"use client";

import Link from "next/link";

import { DataTable, type Column } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatUsdFromCents } from "@/lib/format";

/** Row shape for the Orders table — Dates serialized to ISO strings for the client. */
export type OrderRow = {
  id: string;
  shopifyOrderId: string | null;
  customerName: string | null;
  phoneE164: string;
  status: string | null;
  totalCents: number | null;
  fulfillmentStatus: "unfulfilled" | "fulfilled" | "partial";
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  attributedConversationId: string | null;
  createdAt: string;
};

const columns: Column<OrderRow>[] = [
  {
    key: "order",
    header: "Order",
    cell: (row) => (
      <span className="font-mono text-sm">{row.shopifyOrderId ?? row.id.slice(0, 8)}</span>
    ),
    sortValue: (row) => row.shopifyOrderId ?? row.id.slice(0, 8),
  },
  {
    key: "customer",
    header: "Customer",
    cell: (row) => row.customerName ?? row.phoneE164,
    sortValue: (row) => row.customerName ?? row.phoneE164,
  },
  {
    key: "total",
    header: "Total",
    cell: (row) => formatUsdFromCents(row.totalCents),
    sortValue: (row) => row.totalCents ?? 0,
  },
  {
    key: "fulfillment",
    header: "Fulfillment",
    cell: (row) => <StatusBadge status={row.fulfillmentStatus} />,
    sortValue: (row) => row.fulfillmentStatus,
  },
  {
    key: "delivered",
    header: "Delivered",
    cell: (row) => formatDate(row.deliveredAt),
    sortValue: (row) => row.deliveredAt ?? "",
  },
  {
    key: "attribution",
    header: "Attributed conversation",
    cell: (row) =>
      row.attributedConversationId ? (
        <Link
          href={`/conversations/${row.attributedConversationId}`}
          className="text-primary underline-offset-4 hover:underline"
        >
          View thread
        </Link>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
];

export function OrdersTable({ data }: { data: OrderRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowKey={(row) => row.id}
      emptyMessage="No orders synced yet."
    />
  );
}
