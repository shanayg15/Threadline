"use client";

import { Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Column, DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatRelativeTime, formatUsdFromCents } from "@/lib/format";

import { updateFitNotesAction } from "./actions";

export type VariantRow = {
  id: string;
  title: string | null;
  sku: string | null;
  priceCents: number | null;
  inventoryQty: number | null;
  options: Record<string, string> | null;
};

export type ProductRow = {
  id: string;
  title: string;
  description: string | null;
  fitNotes: string | null;
  status: string;
  /** ISO string (serialized from the server). */
  updatedAt: string;
  variants: VariantRow[];
};

/** Distinct option values across a product's variants, grouped by option key. */
function optionsSummary(variants: VariantRow[]): string {
  const byKey = new Map<string, Set<string>>();
  for (const v of variants) {
    if (!v.options) continue;
    for (const [key, value] of Object.entries(v.options)) {
      const set = byKey.get(key) ?? new Set<string>();
      set.add(value);
      byKey.set(key, set);
    }
  }
  const parts: string[] = [];
  for (const [key, values] of byKey) {
    const label = key.replace(/^\w/, (c) => c.toUpperCase());
    parts.push(`${label}: ${[...values].join(", ")}`);
  }
  return parts.join(" · ");
}

/** Min/max priceCents across variants, formatted as a range (or single value). */
function priceRange(variants: VariantRow[]): string {
  const prices = variants
    .map((v) => v.priceCents)
    .filter((c): c is number => c != null);
  if (prices.length === 0) return "—";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max
    ? formatUsdFromCents(min)
    : `${formatUsdFromCents(min)} – ${formatUsdFromCents(max)}`;
}

/** Lowest priceCents, for sorting the synced-snapshot column. */
function minPrice(variants: VariantRow[]): number {
  const prices = variants
    .map((v) => v.priceCents)
    .filter((c): c is number => c != null);
  return prices.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...prices);
}

/** Sum of inventoryQty across variants (null counted as 0). */
function totalStock(variants: VariantRow[]): number {
  return variants.reduce((sum, v) => sum + (v.inventoryQty ?? 0), 0);
}

export function ProductsClient({
  data,
  canEdit,
}: {
  data: ProductRow[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  function openEditor(row: ProductRow) {
    setEditing(row);
    setDraft(row.fitNotes ?? "");
  }

  function save() {
    if (!editing) return;
    const productId = editing.id;
    const value = draft;
    startTransition(async () => {
      const res = await updateFitNotesAction(productId, value);
      if (res.ok) {
        toast.success("Fit notes saved — the agent's catalog knowledge is updating.");
        setEditing(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  const columns: Column<ProductRow>[] = [
    {
      key: "title",
      header: "Product",
      sortValue: (row) => row.title.toLowerCase(),
      cell: (row) => {
        const opts = optionsSummary(row.variants);
        return (
          <div className="space-y-0.5">
            <div className="font-medium text-foreground">{row.title}</div>
            {opts ? (
              <div className="text-xs text-muted-foreground">{opts}</div>
            ) : (
              <div className="text-xs text-muted-foreground">
                {row.variants.length} variant{row.variants.length === 1 ? "" : "s"}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      sortValue: (row) => row.status,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "snapshot",
      // Price/stock here are the last synced snapshot, not the live figures the
      // agent quotes at answer time — labeled so it isn't mistaken for live.
      header: "Synced snapshot",
      sortValue: (row) => minPrice(row.variants),
      cell: (row) => (
        <div className="space-y-0.5">
          <div className="tabular-nums">{priceRange(row.variants)}</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {totalStock(row.variants)} in stock
          </div>
        </div>
      ),
    },
    {
      key: "fitNotes",
      header: "Fit notes",
      cell: (row) =>
        row.fitNotes ? (
          <span className="line-clamp-2 max-w-xs text-sm text-muted-foreground">
            {row.fitNotes}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground/60">None yet</span>
        ),
    },
    {
      key: "updatedAt",
      header: "Updated",
      sortValue: (row) => row.updatedAt,
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {formatRelativeTime(row.updatedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openEditor(row)}
          disabled={!canEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
          Fit notes
        </Button>
      ),
    },
  ];

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        Fit notes are your private guidance on sizing, materials, and care. The
        concierge reads them to ground its answers — price and stock shown here are
        the last synced snapshot, while the agent always quotes live Shopify figures.
      </p>

      <DataTable
        columns={columns}
        data={data}
        getRowKey={(row) => row.id}
        emptyMessage="No products synced yet."
      />

      <Dialog open={editing !== null} onOpenChange={(open) => (open ? null : setEditing(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fit notes — {editing?.title}</DialogTitle>
            <DialogDescription>
              These feed the agent&apos;s answers. Note how this product runs (sizing,
              fabric, care) so the concierge replies the way you would.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Runs small — size up if between sizes. Heavyweight French terry, cold wash."
            rows={6}
            disabled={isPending || !canEdit}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={save} disabled={isPending || !canEdit}>
              {isPending ? "Saving…" : "Save fit notes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
