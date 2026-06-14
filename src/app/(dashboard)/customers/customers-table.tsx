"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Column, DataTable } from "@/components/data-table";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatPhone, formatRelativeTime } from "@/lib/format";

/** Row shape passed from the server page — Dates are serialized to ISO strings so the
 * client component receives plain JSON. We format them in the cells below. */
export type CustomerRow = {
  id: string;
  name: string | null;
  phoneE164: string;
  consentStatus: "opted_in" | "opted_out" | "unknown";
  experimentGroup: "treatment" | "control" | null;
  orderCount: number;
  lastContactAt: string | null;
  createdAt: string;
  conversationId: string | null;
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function CustomersTable({ rows }: { rows: CustomerRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const name = (row.name ?? "").toLowerCase();
      const phone = row.phoneE164.toLowerCase();
      const pretty = formatPhone(row.phoneE164).toLowerCase();
      return name.includes(q) || phone.includes(q) || pretty.includes(q);
    });
  }, [rows, query]);

  const columns: Column<CustomerRow>[] = [
    {
      key: "name",
      header: "Name",
      sortValue: (row) => row.name ?? "",
      cell: (row) =>
        row.conversationId ? (
          <Link
            href={`/conversations/${row.conversationId}`}
            className="font-medium hover:underline"
          >
            {row.name ?? "—"}
          </Link>
        ) : (
          <span className="font-medium">{row.name ?? "—"}</span>
        ),
    },
    {
      key: "phone",
      header: "Phone",
      sortValue: (row) => row.phoneE164,
      cell: (row) => formatPhone(row.phoneE164),
    },
    {
      key: "consent",
      header: "Consent",
      sortValue: (row) => row.consentStatus,
      cell: (row) => <StatusBadge status={row.consentStatus} />,
    },
    {
      key: "group",
      header: "Group",
      sortValue: (row) => row.experimentGroup ?? "",
      cell: (row) => (row.experimentGroup ? capitalize(row.experimentGroup) : "—"),
    },
    {
      key: "orders",
      header: "Orders",
      className: "text-right",
      sortValue: (row) => row.orderCount,
      cell: (row) => row.orderCount,
    },
    {
      key: "lastContact",
      header: "Last contact",
      sortValue: (row) => row.lastContactAt ?? "",
      cell: (row) => (row.lastContactAt ? formatRelativeTime(row.lastContactAt) : "—"),
    },
    {
      key: "created",
      header: "Created",
      sortValue: (row) => row.createdAt,
      cell: (row) => formatDate(row.createdAt),
    },
  ];

  return (
    <div className="space-y-4">
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or phone…"
        className="max-w-xs"
      />
      <DataTable
        columns={columns}
        data={filtered}
        getRowKey={(row) => row.id}
        emptyMessage="No customers match your search."
      />
    </div>
  );
}
