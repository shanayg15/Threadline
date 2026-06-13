import { cn } from "@/lib/utils";

/**
 * Maps conversation/consent statuses to a colored pill. Generic by design — later
 * milestones render conversation status, consent status, etc. through this.
 */
const STYLES: Record<string, { label: string; className: string }> = {
  // conversation status
  automated: { label: "Automated", className: "bg-emerald-100 text-emerald-800" },
  escalated: { label: "Escalated", className: "bg-amber-100 text-amber-800" },
  blocked: { label: "Blocked", className: "bg-red-100 text-red-800" },
  closed: { label: "Closed", className: "bg-muted text-muted-foreground" },
  // consent status
  opted_in: { label: "Opted in", className: "bg-emerald-100 text-emerald-800" },
  opted_out: { label: "Opted out", className: "bg-red-100 text-red-800" },
  unknown: { label: "Unknown", className: "bg-muted text-muted-foreground" },
  // fulfillment
  fulfilled: { label: "Fulfilled", className: "bg-emerald-100 text-emerald-800" },
  partial: { label: "Partial", className: "bg-amber-100 text-amber-800" },
  unfulfilled: { label: "Unfulfilled", className: "bg-muted text-muted-foreground" },
};

function humanize(status: string): string {
  return status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const style = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        style?.className ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {style?.label ?? humanize(status)}
    </span>
  );
}
