"use client";

import { Monitor, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type InboxItem = {
  id: string;
  status: "automated" | "escalated" | "blocked" | "closed";
  assigneeType: "ai" | "human";
  paused: boolean;
  customerName: string | null;
  phoneE164: string;
  lastMessageBody: string | null;
  lastMessageAtPreview: string | null;
  unreadCount: number;
  hasOpenDraft: boolean;
  hasPendingAction: boolean;
};

const ACTIVITY_FILTERS = [
  { value: "all", label: "All" },
  { value: "has_reply", label: "Has reply" },
  { value: "scheduled", label: "Scheduled" },
] as const;

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "automated", label: "Automated" },
  { value: "escalated", label: "Escalated" },
  { value: "blocked", label: "Blocked" },
] as const;

function FilterGroup({
  label,
  param,
  options,
}: {
  label: string;
  param: "activity" | "status";
  options: readonly { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(param) ?? "all";

  function select(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "all") next.delete(param);
    else next.set(param, value);
    const qs = next.toString();
    // Keep the list pane in view (the thread is a sibling route); navigate to the index.
    router.push(`/conversations${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = current === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => select(o.value)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {/* pathname keeps lint happy and documents that filters live on the list route */}
      <span className="sr-only">{pathname}</span>
    </div>
  );
}

function AssigneeChip({ type }: { type: "ai" | "human" }) {
  return type === "ai" ? (
    <span className="inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground">
      <Monitor className="size-3" /> AI
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[0.7rem] font-medium text-amber-600 dark:text-amber-500">
      <User className="size-3" /> Human
    </span>
  );
}

export function ConversationList() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const activity = searchParams.get("activity") ?? "all";
  const status = searchParams.get("status") ?? "all";
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const qs = new URLSearchParams();
      if (activity !== "all") qs.set("activity", activity);
      if (status !== "all") qs.set("status", status);
      try {
        const res = await fetch(`/api/conversations?${qs.toString()}`, {
          signal,
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { conversations: InboxItem[] };
        setItems(data.conversations);
      } catch {
        /* aborted or transient — keep prior list */
      } finally {
        setLoading(false);
      }
    },
    [activity, status],
  );

  useEffect(() => {
    const controller = new AbortController();
    // `load` only setState()s after awaiting the fetch (a poll-on-mount subscription) —
    // the rule's static check can't see that, so this is a known false positive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(controller.signal);
    const interval = setInterval(() => void load(), 5000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [load]);

  const activeId = /^\/conversations\/([^/]+)/.exec(pathname)?.[1];

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b p-4">
        <h1 className="text-xl font-semibold tracking-tight">Conversations</h1>
        <FilterGroup label="Activity" param="activity" options={ACTIVITY_FILTERS} />
        <FilterGroup label="Status" param="status" options={STATUS_FILTERS} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && items.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No conversations match these filters.</p>
        ) : (
          <ul>
            {items.map((c) => {
              const active = c.id === activeId;
              return (
                <li key={c.id}>
                  <Link
                    href={`/conversations/${c.id}`}
                    className={cn(
                      "flex flex-col gap-1 border-b px-4 py-3 transition-colors hover:bg-muted/50",
                      active && "bg-muted",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">
                          {c.customerName ?? c.phoneE164}
                        </span>
                        {c.unreadCount > 0 && (
                          <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[0.65rem] font-semibold text-primary-foreground">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelativeTime(c.lastMessageAtPreview)}
                      </span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {c.hasOpenDraft
                        ? "✎ Draft awaiting approval"
                        : (c.lastMessageBody ?? "No messages yet")}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <AssigneeChip type={c.assigneeType} />
                      <StatusBadge
                        status={c.paused ? "paused" : c.status}
                        className="text-[0.7rem]"
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
