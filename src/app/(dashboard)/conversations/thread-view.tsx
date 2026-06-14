"use client";

import {
  Check,
  ChevronDown,
  Monitor,
  Paperclip,
  Pause,
  Pencil,
  Play,
  Send,
  User,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatAbsoluteTime, formatClockTime, formatPhone, formatUsdFromCents } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  approveDraftAction,
  rejectDraftAction,
  resolveAction,
  sendHumanReplyAction,
  setAssigneeAction,
  setPausedAction,
} from "./actions";
import type {
  ThreadConversation,
  ThreadCustomer,
  ThreadDraft,
  ThreadMessage,
  ThreadOrder,
  ThreadPendingAction,
} from "./types";

type Props = {
  conversation: ThreadConversation;
  customer: ThreadCustomer;
  initialMessages: ThreadMessage[];
  initialDraft: ThreadDraft | null;
  orders: ThreadOrder[];
  pendingAction: ThreadPendingAction | null;
  supervised: boolean;
  canMutate: boolean;
};

function deliveryLabel(status: ThreadMessage["deliveryStatus"]): string | null {
  switch (status) {
    case "delivered":
      return "Delivered";
    case "sent":
      return "Sent";
    case "queued":
      return "Queued";
    case "failed":
      return "Failed";
    default:
      return null; // never show "Read" — SMS reports delivery, not read
  }
}

function MessageBubble({ m, assigneeName }: { m: ThreadMessage; assigneeName: string | null }) {
  const outbound = m.direction === "outbound";
  const senderLabel = m.sender === "human" ? (assigneeName ?? "Teammate") : "AI Assistant";
  const delivery = deliveryLabel(m.deliveryStatus);

  return (
    <div className={cn("flex flex-col", outbound ? "items-end" : "items-start")}>
      {outbound && (
        <div className="mb-1 flex items-center gap-1 px-1 text-[0.7rem] text-muted-foreground">
          {m.sender === "human" ? <User className="size-3" /> : <Monitor className="size-3" />}
          {senderLabel}
        </div>
      )}
      <div
        className={cn(
          "max-w-[78%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
          outbound
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted text-foreground",
        )}
      >
        {m.body}
        {m.mediaUrls && m.mediaUrls.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {m.mediaUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="attachment" className="rounded-lg" />
            ))}
          </div>
        )}
      </div>
      <div
        className={cn(
          "mt-1 px-1 text-[0.7rem] text-muted-foreground",
          outbound ? "text-right" : "text-left",
        )}
      >
        {formatClockTime(m.createdAt)}
        {outbound && delivery ? ` · ${delivery}` : ""}
      </div>
    </div>
  );
}

function OrdersPanel({ orders, customer }: { orders: ThreadOrder[]; customer: ThreadCustomer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium hover:bg-muted/40"
      >
        <span>ORDERS ({orders.length})</span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-2 px-4 pb-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <StatusBadge status={customer.consentStatus} />
            {customer.experimentGroup && (
              <span className="rounded-md bg-muted px-2 py-0.5 capitalize text-muted-foreground">
                {customer.experimentGroup}
              </span>
            )}
            <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
              {customer.timezone}
            </span>
          </div>
          {orders.length === 0 ? (
            <p className="text-xs text-muted-foreground">No orders on file.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">
                    {o.shopifyOrderId ?? o.id.slice(0, 8)}
                  </span>
                  <span className="flex items-center gap-3">
                    <StatusBadge status={o.fulfillmentStatus} className="text-[0.7rem]" />
                    <span>{formatUsdFromCents(o.totalCents)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function ThreadView({
  conversation,
  customer,
  initialMessages,
  initialDraft,
  orders,
  pendingAction,
  supervised,
  canMutate,
}: Props) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [draft, setDraft] = useState<ThreadDraft | null>(initialDraft);
  const [status, setStatus] = useState(conversation.status);
  const [assigneeType, setAssigneeType] = useState(conversation.assigneeType);
  const [paused, setPaused] = useState(conversation.paused);
  const [composer, setComposer] = useState("");
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(initialDraft?.body ?? "");
  const [isPending, startTransition] = useTransition();

  const scrollRef = useRef<HTMLDivElement>(null);
  const sinceRef = useRef<string>(
    initialMessages.length > 0
      ? (initialMessages[initialMessages.length - 1]?.createdAt ?? "")
      : "",
  );

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  /** Poll for new visible messages + the current open draft. */
  const poll = useCallback(
    async (full = false) => {
      const since = full
        ? new Date(0).toISOString()
        : sinceRef.current || new Date(0).toISOString();
      try {
        const res = await fetch(
          `/api/conversations/${conversation.id}/messages?since=${encodeURIComponent(since)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { messages: ThreadMessage[]; draft: ThreadDraft | null };
        setDraft(data.draft);
        if (data.draft) setEditBody((b) => (editing ? b : (data.draft?.body ?? "")));
        if (data.messages.length > 0) {
          setMessages((prev) => {
            const base = full ? [] : prev;
            const seen = new Set(base.map((m) => m.id));
            const merged = [...base, ...data.messages.filter((m) => !seen.has(m.id))];
            const last = merged[merged.length - 1];
            if (last) sinceRef.current = last.createdAt;
            return merged;
          });
          setTimeout(scrollToBottom, 0);
        }
      } catch {
        /* transient */
      }
    },
    [conversation.id, editing, scrollToBottom],
  );

  useEffect(() => {
    const interval = setInterval(() => void poll(), 4000);
    return () => clearInterval(interval);
  }, [poll]);

  function run(label: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) toast.error(result.error);
      else if (label) toast.success(label);
    });
  }

  function onToggleAssignee(next: "ai" | "human") {
    if (next === assigneeType) return;
    const prev = { assigneeType, status };
    setAssigneeType(next);
    if (next === "ai") setStatus("automated");
    startTransition(async () => {
      const r = await setAssigneeAction(conversation.id, next);
      if (!r.ok) {
        setAssigneeType(prev.assigneeType);
        setStatus(prev.status);
        toast.error(r.error);
      }
    });
  }

  function onTogglePause() {
    const next = !paused;
    setPaused(next);
    startTransition(async () => {
      const r = await setPausedAction(conversation.id, next);
      if (!r.ok) {
        setPaused(!next);
        toast.error(r.error);
      } else toast.success(next ? "Agent paused" : "Agent resumed");
    });
  }

  function onResolve() {
    setStatus("automated");
    setAssigneeType("ai");
    run("Returned to AI", () => resolveAction(conversation.id));
  }

  function onSend() {
    const body = composer.trim();
    if (!body) return;
    setComposer("");
    startTransition(async () => {
      const r = await sendHumanReplyAction(conversation.id, body);
      if (!r.ok) {
        setComposer(body);
        toast.error(r.error);
      } else {
        setAssigneeType("human");
        await poll();
      }
    });
  }

  function onApprove(edited?: string) {
    const draftId = draft?.id;
    if (!draftId) return;
    startTransition(async () => {
      const r = await approveDraftAction(conversation.id, draftId, edited);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success("Sent");
        setEditing(false);
        setDraft(null);
        await poll(true); // full refetch — the approved reply is an in-place row update
      }
    });
  }

  function onReject() {
    const draftId = draft?.id;
    if (!draftId) return;
    setDraft(null);
    setEditing(false);
    run("Draft rejected", () => rejectDraftAction(conversation.id, draftId));
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{customer.name ?? "Unknown customer"}</h2>
          <p className="font-mono text-xs text-muted-foreground">
            {formatPhone(customer.phoneE164)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="inline-flex rounded-lg border p-0.5">
            {(["ai", "human"] as const).map((t) => (
              <button
                key={t}
                type="button"
                disabled={!canMutate || isPending}
                onClick={() => onToggleAssignee(t)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                  assigneeType === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {t === "ai" ? <Monitor className="size-3" /> : <User className="size-3" />}
                {t === "ai" ? "AI" : "Human"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={status} className="text-[0.7rem]" />
            {status === "escalated" && canMutate && (
              <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={onResolve}>
                Resolve
              </Button>
            )}
          </div>
          {messages.length > 0 && (
            <span className="text-[0.7rem] text-muted-foreground">
              {formatAbsoluteTime(messages[messages.length - 1]?.createdAt)}
            </span>
          )}
        </div>
      </div>

      <OrdersPanel orders={orders} customer={customer} />

      {pendingAction && (
        <div className="border-b bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Awaiting customer confirmation:{" "}
          <span className="font-medium">{pendingAction.summary ?? pendingAction.type}</span>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} m={m} assigneeName={conversation.assigneeName} />
          ))
        )}
      </div>

      {/* Supervised draft bar */}
      {draft && (
        <div className="border-t bg-muted/40 px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Monitor className="size-3" /> AI draft awaiting your approval
          </div>
          {editing ? (
            <Textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={3}
              className="mb-2 bg-background"
            />
          ) : (
            <p className="mb-2 whitespace-pre-wrap rounded-lg bg-background p-3 text-sm">
              {draft.body}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {editing ? (
              <>
                <Button size="sm" disabled={isPending} onClick={() => onApprove(editBody)}>
                  <Check className="size-4" /> Send edited
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" disabled={!canMutate || isPending} onClick={() => onApprove()}>
                  <Check className="size-4" /> Approve & send
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canMutate || isPending}
                  onClick={() => {
                    setEditBody(draft.body ?? "");
                    setEditing(true);
                  }}
                >
                  <Pencil className="size-4" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!canMutate || isPending}
                  onClick={onReject}
                >
                  <X className="size-4" /> Reject
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled
            title="Attachments coming soon"
          >
            <Paperclip className="size-4" />
          </Button>
          <Textarea
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Type a message…"
            rows={1}
            disabled={!canMutate}
            className="max-h-32 min-h-9 resize-none"
          />
          <Button
            type="button"
            disabled={!canMutate || isPending || !composer.trim()}
            onClick={onSend}
          >
            <Send className="size-4" /> Send
          </Button>
          <Button
            type="button"
            variant={paused ? "default" : "outline"}
            disabled={!canMutate || isPending}
            onClick={onTogglePause}
            title={paused ? "Resume the agent" : "Pause the agent"}
          >
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
            {paused ? "Resume" : "Pause"}
          </Button>
        </div>
        <p className="mt-1.5 px-1 text-[0.7rem] text-muted-foreground">
          Press Enter to send, Shift+Enter for a new line.
          {supervised && !draft ? " · Supervised mode — agent replies are held for approval." : ""}
        </p>
      </div>
    </div>
  );
}
