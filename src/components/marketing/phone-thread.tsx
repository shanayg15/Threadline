"use client";

import { Signal, Wifi, BatteryFull } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Animated phone message-thread mock for the hero. Cycles through a few short, original
 * example conversations with fictional demo brands, revealing messages one at a time.
 *
 * Honesty: this is a generic SMS-style thread (our own monochrome bubbles) — we never
 * label it "iMessage". Respects `prefers-reduced-motion`: with motion reduced we render
 * the first thread in full, statically, and stop rotating.
 */

type Msg = { from: "agent" | "customer"; text: string };
type DemoThread = { brand: string; customer: string; tag: string; messages: Msg[] };

const THREADS: DemoThread[] = [
  {
    brand: "Demo Apparel Co",
    customer: "Maya R.",
    tag: "Fit & size, before checkout",
    messages: [
      {
        from: "agent",
        text: "Hi Maya — Demo Apparel Co here. You were looking at the Field Jacket. Stuck between a medium and a large?",
      },
      { from: "customer", text: "yeah, usually a medium but I want to layer a knit under it" },
      {
        from: "agent",
        text: "Then I'd size up to the large — it runs trim through the shoulders, so you'll want the room. Want me to grab one for you?",
      },
      { from: "customer", text: "yes please" },
      {
        from: "agent",
        text: "Done. Here's a secure checkout link for the large — you're all set 👇",
      },
    ],
  },
  {
    brand: "Maple & Oat",
    customer: "Devin K.",
    tag: "Delivery check-in → cross-sell",
    messages: [
      {
        from: "agent",
        text: "Hey Devin — your pour-over kit arrived yesterday. How's the first brew going?",
      },
      { from: "customer", text: "good! runs a little fast though" },
      {
        from: "agent",
        text: "A finer grind and a slower pour will fix that. Our medium roast is dialed in for this kit if you want to try it — want the link?",
      },
      { from: "customer", text: "go for it" },
    ],
  },
  {
    brand: "Northrock Supply",
    customer: "Sam P.",
    tag: "Replenishment & save",
    messages: [
      {
        from: "agent",
        text: "Hi Sam — you're about two weeks out on the salmon kibble. Reorder the 12 lb, or switch to an every-6-weeks plan and save?",
      },
      { from: "customer", text: "the plan sounds good" },
      {
        from: "agent",
        text: "Nice. I'll set up the subscription and send a confirmation for you to approve — nothing's charged until you say yes.",
      },
    ],
  },
];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function PhoneThread() {
  const reduced = usePrefersReducedMotion();
  const [threadIdx, setThreadIdx] = useState(0);
  const [visible, setVisible] = useState(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const thread = THREADS[threadIdx] ?? THREADS[0]!;
  const total = thread.messages.length;
  const shown = reduced ? total : visible;

  useEffect(() => {
    if (reduced) return;
    if (timer.current) clearTimeout(timer.current);
    if (visible < total) {
      timer.current = setTimeout(() => setVisible((v) => v + 1), 1150);
    } else {
      // Pause on a completed thread, then advance to the next one.
      timer.current = setTimeout(() => {
        setThreadIdx((i) => (i + 1) % THREADS.length);
        setVisible(1);
      }, 2600);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [visible, total, reduced]);

  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      {/* soft brand glow behind the device */}
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[3rem] bg-primary/15 blur-2xl" />
      <div className="rounded-[2.5rem] border border-border/60 bg-foreground/95 p-2.5 shadow-2xl">
        <div className="overflow-hidden rounded-[2rem] bg-background">
          {/* status bar */}
          <div className="flex items-center justify-between bg-card px-6 pt-3 text-[0.7rem] font-medium text-muted-foreground">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <Signal className="size-3" />
              <Wifi className="size-3" />
              <BatteryFull className="size-3.5" />
            </div>
          </div>

          {/* conversation header */}
          <div className="border-b bg-card px-4 pb-3 pt-2 text-center">
            <div className="mx-auto flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {thread.customer
                .split(" ")
                .map((p) => p[0])
                .join("")}
            </div>
            <p className="mt-1 text-sm font-semibold leading-tight">{thread.customer}</p>
            <p className="text-[0.7rem] text-muted-foreground">{thread.brand} · via SMS</p>
          </div>

          {/* messages */}
          <div className="flex h-[360px] flex-col justify-end gap-2 px-3.5 py-4">
            {thread.messages.slice(0, shown).map((m, i) => {
              const agent = m.from === "agent";
              return (
                <div
                  key={`${threadIdx}-${i}`}
                  className={cn(
                    "flex flex-col",
                    agent ? "items-end" : "items-start",
                    !reduced &&
                      "motion-safe:duration-500 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[82%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[0.8rem] leading-snug",
                      agent
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-muted text-foreground",
                    )}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })}
          </div>

          {/* faux composer */}
          <div className="flex items-center gap-2 border-t bg-card px-3 py-2.5">
            <div className="flex-1 rounded-full border bg-background px-3 py-1.5 text-[0.75rem] text-muted-foreground">
              Message {thread.customer.split(" ")[0]}…
            </div>
            <div className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-[0.7rem] font-bold text-primary">
              ↑
            </div>
          </div>
        </div>
      </div>

      {/* caption */}
      <p className="mt-4 text-center text-xs text-muted-foreground" aria-live="polite">
        {thread.tag} · illustrative example
      </p>
    </div>
  );
}
