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
  Bot,
  UserRound,
} from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { SectionHeading } from "@/components/marketing/section-heading";
import { cn } from "@/lib/utils";

/**
 * Static, non-interactive recreation of the real M7 Conversations console, rendered in
 * Threadline's brand with the fictional demo brand "Demo Apparel Co". It mirrors the
 * three-pane layout (nav rail · filterable list · thread) of the shipped product.
 *
 * Honesty: outbound bubbles show the real delivery status ("Delivered"/"Sent") — never a
 * fabricated "Read" receipt, which SMS does not report. Swap in a real screenshot of the
 * /conversations route any time; the layout already matches.
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
    status === "Escalated"
      ? "bg-amber-100 text-amber-800"
      : status === "Blocked"
        ? "bg-muted text-muted-foreground"
        : "bg-secondary text-secondary-foreground";
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-[0.65rem] font-medium", tone)}>
      {status}
    </span>
  );
}

function BENEFITS() {
  return [
    {
      icon: Bot,
      title: "AI resolves the routine",
      body: "Most threads — fit, stock, policy, a delivery check-in — are answered end to end in your brand's voice, grounded in live data.",
    },
    {
      icon: UserRound,
      title: "Humans take the exceptions",
      body: "Anything unusual escalates to a teammate in the same thread, with full history and a one-tap pause on the agent.",
    },
    {
      icon: BarChart3,
      title: "Everything is measured",
      body: "Conversations, outcomes, and attributed orders roll up against a holdout — so you see honest impact, not vanity clicks.",
    },
  ];
}

export function ConsoleShowcase() {
  return (
    <section id="product" className="scroll-mt-20 bg-card/30">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-6 lg:py-24">
        <SectionHeading
          eyebrow="The console"
          title="Manage every buyer conversation in one place"
          lead="Your team works the whole relationship from one surface — a filterable inbox, the full thread, the customer's orders, and a one-tap switch between the agent and a human."
        />

        {/* Console frame */}
        <div className="mt-12 overflow-hidden rounded-xl border bg-card shadow-xl">
          {/* faux app top bar */}
          <div className="flex items-center gap-2 border-b bg-background/60 px-4 py-2.5">
            <span className="size-2.5 rounded-full bg-destructive/40" />
            <span className="size-2.5 rounded-full bg-amber-400/50" />
            <span className="size-2.5 rounded-full bg-emerald-400/50" />
            <span className="ml-3 text-xs text-muted-foreground">threadline.app/conversations</span>
          </div>

          <div className="flex h-[480px] text-sm">
            {/* nav rail */}
            <aside className="hidden w-52 flex-col border-r bg-card md:flex">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <BrandLogo />
              </div>
              <nav className="flex flex-col gap-1 p-2">
                {NAV.map(({ icon: Icon, label, active }) => (
                  <span
                    key={label}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
                      active
                        ? "bg-primary font-medium text-primary-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    {label}
                  </span>
                ))}
              </nav>
            </aside>

            {/* conversation list */}
            <div className="hidden w-72 flex-col border-r lg:flex">
              <div className="border-b p-4">
                <p className="text-base font-semibold">Conversations</p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      Activity
                    </span>
                  </div>
                  <div className="flex gap-1 rounded-full bg-muted/60 p-0.5">
                    <Pill label="All" />
                    <Pill label="Has reply" active />
                    <Pill label="Scheduled" />
                  </div>
                  <div className="flex gap-1 rounded-full bg-muted/60 p-0.5">
                    <Pill label="All" />
                    <Pill label="Automated" active />
                    <Pill label="Escalated" />
                    <Pill label="Blocked" />
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                {LIST.map((c) => (
                  <div
                    key={c.name}
                    className={cn("border-b px-4 py-3", c.active && "bg-accent/60")}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-medium">
                        {c.name}
                        {c.unread ? (
                          <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[0.6rem] font-bold text-primary-foreground">
                            {c.unread}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-xs text-muted-foreground">{c.time}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{c.snippet}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {c.badge && (
                        <span className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
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
              <div className="flex items-center justify-between border-b px-5 py-3">
                <div>
                  <p className="font-semibold">Maya R.</p>
                  <p className="text-xs text-muted-foreground">+1 (415) 555-0192</p>
                </div>
                <div className="flex items-center gap-1 rounded-full border p-0.5 text-xs">
                  <span className="flex items-center gap-1 rounded-full bg-foreground px-2.5 py-1 font-medium text-background">
                    <Monitor className="size-3" /> AI
                  </span>
                  <span className="flex items-center gap-1 px-2.5 py-1 text-muted-foreground">
                    <UserRound className="size-3" /> Human
                  </span>
                </div>
              </div>

              {/* orders strip */}
              <div className="flex items-center justify-between border-b bg-card/40 px-5 py-2 text-xs">
                <span className="font-medium text-muted-foreground">Orders (1)</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>

              {/* messages */}
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
                      <div className="mt-1 px-1 text-[0.7rem] text-muted-foreground">{m.time}</div>
                    </div>
                  ),
                )}
              </div>

              {/* composer */}
              <div className="border-t p-3">
                <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-muted-foreground">
                  <Paperclip className="size-4" />
                  <span className="flex-1 text-xs">Type a message…</span>
                  <span className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
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

        <p className="mt-3 text-center text-xs text-muted-foreground">
          A faithful render of the Threadline console · sample data for “Demo Apparel Co”
        </p>

        {/* benefit blurbs */}
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {BENEFITS().map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
