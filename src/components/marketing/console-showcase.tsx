import {
  MessagesSquare,
  BarChart3,
  Users,
  ShoppingBag,
  Package,
  Settings,
  Monitor,
  Check,
  ChevronRight,
  Paperclip,
  Pause,
  UserRound,
  ChevronDown,
} from "lucide-react";

import { SectionHeading } from "@/components/marketing/section-heading";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

/**
 * Static, non-interactive recreation of the real M7 Conversations console, rendered in
 * Threadline's brand with the fictional demo brand "Demo Apparel Co". Mirrors the
 * three-pane layout (nav rail · filterable list · thread) of the shipped product, shown
 * on a subtle 3D tilt. Honesty: outbound bubbles show the real delivery status
 * ("Delivered"/"Sent") — never a fabricated "Read" receipt, which SMS does not report.
 */

const NAV = [
  { icon: MessagesSquare, label: "Conversations", active: true },
  { icon: BarChart3, label: "Analytics" },
  { icon: Users, label: "Customers" },
  { icon: ShoppingBag, label: "Orders" },
  { icon: Package, label: "Products" },
  { icon: Settings, label: "Settings" },
];

const LIST = [
  {
    name: "Maya R.",
    snippet: "Perfect, the large fits great with a sweater under…",
    time: "3m",
    badge: "AI",
    status: "Automated",
    unread: 2,
    active: true,
  },
  {
    name: "Devin K.",
    snippet: "Can we swap the pour-over for the larger size?",
    time: "14m",
    badge: "Human",
    status: "Escalated",
  },
  {
    name: "Priya S.",
    snippet: "Photo uploaded for a fit question",
    time: "31m",
    badge: "AI",
    status: "Automated",
  },
  {
    name: "Sam P.",
    snippet: "No reply yet — reminder scheduled",
    time: "52m",
    badge: null,
    status: "Blocked",
  },
];

const THREAD = [
  {
    dir: "out" as const,
    sender: "AI Assistant",
    text: "Hi Maya, it's the team at Demo Apparel Co. Your Field Jacket was delivered — how's the fit so far?",
    time: "11:12 AM",
    status: "Delivered",
  },
  {
    dir: "in" as const,
    text: "Hi! Just tried it on — love it, but I wish it had a touch more room for layering.",
    time: "11:13 AM",
  },
  {
    dir: "out" as const,
    sender: "AI Assistant",
    text: "Good to know. The large gives you that room and runs trim through the shoulders — want me to set one aside for an easy exchange?",
    time: "11:14 AM",
    status: "Sent",
  },
];

function Pill({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium",
        active ? "bg-foreground text-background" : "text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Escalated" ? "bg-amber-100 text-amber-800" : "bg-secondary text-muted-foreground";
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[0.65rem] font-medium", tone)}>{status}</span>
  );
}

const BENEFITS = [
  {
    title: "AI resolves the routine",
    body: "Most threads — fit, stock, policy, a delivery check-in — are answered end to end in your brand's voice, grounded in live data.",
  },
  {
    title: "Humans take the exceptions",
    body: "Anything unusual escalates to a teammate in the same thread, with full history and a one-tap pause on the agent.",
  },
  {
    title: "Everything is measured",
    body: "Conversations, outcomes, and attributed orders roll up against a holdout — so you see honest impact, not vanity clicks.",
  },
];

export function ConsoleShowcase() {
  return (
    <section id="product" className="scroll-mt-20 border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <SectionHeading
          title="Manage every buyer conversation in one place"
          lead="Most inbound and post-delivery threads resolve fully with AI. When something unusual appears, it escalates to a human in the same thread — and your team steps in without losing context."
        />

        {/* Console frame on a subtle 3D tilt */}
        <div className="mt-14 [perspective:2200px]">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl [transform:rotateX(3deg)]">
            {/* app top bar */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <BrandLogo className="[&_span]:text-lg" />
                <span className="text-sm text-muted-foreground">/ Demo Apparel Co</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="flex size-7 items-center justify-center rounded-full bg-foreground text-[0.65rem] font-semibold text-background">
                  JD
                </span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </div>
            </div>

            <div className="flex h-[460px] text-sm">
              {/* nav rail */}
              <aside className="hidden w-48 flex-col border-r border-border p-2 md:flex">
                {NAV.map(({ icon: Icon, label, active }) => (
                  <span
                    key={label}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm",
                      active ? "bg-accent font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" strokeWidth={1.75} />
                    {label}
                  </span>
                ))}
              </aside>

              {/* conversation list */}
              <div className="hidden w-72 flex-col border-r border-border lg:flex">
                <div className="border-b border-border p-4">
                  <p className="font-serif text-lg font-medium">Conversations</p>
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Activity
                    </p>
                    <div className="flex gap-1 rounded-full bg-muted p-0.5">
                      <Pill label="All" />
                      <Pill label="Has reply" active />
                      <Pill label="Scheduled" />
                    </div>
                    <div className="flex gap-1 rounded-full bg-muted p-0.5">
                      <Pill label="All" />
                      <Pill label="Automated" active />
                      <Pill label="Escalated" />
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  {LIST.map((c) => (
                    <div
                      key={c.name}
                      className={cn("border-b border-border px-4 py-3", c.active && "bg-accent/60")}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 font-medium">
                          {c.name}
                          {c.unread ? (
                            <span className="flex size-4 items-center justify-center rounded-full bg-foreground text-[0.6rem] font-bold text-background">
                              {c.unread}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-xs text-muted-foreground">{c.time}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{c.snippet}</p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {c.badge && (
                          <span className="flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                            {c.badge === "AI" ? (
                              <Monitor className="size-2.5" />
                            ) : (
                              <UserRound className="size-2.5" />
                            )}
                            {c.badge}
                          </span>
                        )}
                        <StatusBadge status={c.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* thread pane */}
              <div className="flex flex-1 flex-col">
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <div>
                    <p className="font-medium">Maya R.</p>
                    <p className="text-xs text-muted-foreground">+1 (415) 555-0192</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full border border-border p-0.5 text-xs">
                    <span className="flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 font-medium text-background">
                      <Monitor className="size-3" /> AI
                    </span>
                    <span className="flex items-center gap-1 px-2.5 py-1 text-muted-foreground">
                      <UserRound className="size-3" /> Human
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-2 text-xs">
                  <span className="font-medium text-muted-foreground">Orders (1)</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>

                <div className="flex flex-1 flex-col justify-end gap-3 overflow-hidden p-5">
                  {THREAD.map((m, i) =>
                    m.dir === "out" ? (
                      <div key={i} className="flex flex-col items-end">
                        <div className="mb-1 flex items-center gap-1 px-1 text-[0.7rem] text-muted-foreground">
                          <Monitor className="size-3" /> {m.sender}
                        </div>
                        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                          {m.text}
                        </div>
                        <div className="mt-1 flex items-center gap-1 px-1 text-[0.7rem] text-muted-foreground">
                          {m.time} · <Check className="size-3" /> {m.status}
                        </div>
                      </div>
                    ) : (
                      <div key={i} className="flex flex-col items-start">
                        <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-sm">
                          {m.text}
                        </div>
                        <div className="mt-1 px-1 text-[0.7rem] text-muted-foreground">
                          {m.time}
                        </div>
                      </div>
                    ),
                  )}
                </div>

                <div className="border-t border-border p-3">
                  <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-muted-foreground">
                    <Paperclip className="size-4" />
                    <span className="flex-1 text-xs">Type a message…</span>
                    <span className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                      Send
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between px-1 text-[0.7rem] text-muted-foreground">
                    <span>Enter to send · Shift+Enter for a new line</span>
                    <span className="flex items-center gap-1">
                      <Pause className="size-3" /> Pause
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          A faithful render of the Threadline console · sample data for “Demo Apparel Co”
        </p>

        {/* benefit blurbs */}
        <div className="mt-14 grid gap-8 border-t border-border pt-10 sm:grid-cols-3">
          {BENEFITS.map(({ title, body }) => (
            <div key={title}>
              <h3 className="font-medium">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
