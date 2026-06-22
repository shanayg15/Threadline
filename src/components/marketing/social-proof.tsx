import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { SectionHeading } from "@/components/marketing/section-heading";
import { Button } from "@/components/ui/button";

/**
 * Honest social-proof handling (M9 guardrail). We have no customers yet, so we do NOT
 * fabricate testimonials, brand names, quotes, or metrics. Instead we show a clearly
 * labeled *illustrative scenario* describing the kind of outcome the product is designed
 * to produce, plus a "case studies coming soon" note.
 */

const STEPS = [
  {
    when: "Before checkout",
    text: "A shopper texts that they're between sizes. The agent reads the product's fit notes and their past orders, recommends the confident pick, and hands over a checkout link — instead of losing them to a half-filled cart.",
  },
  {
    when: "After delivery",
    text: "Once the order is actually delivered, Threadline checks in. A fit complaint that would have become a return is steered into an exchange for the right size — kept, not refunded.",
  },
  {
    when: "Next purchase",
    text: "Weeks later, the same thread surfaces a genuinely useful add-on and a well-timed reorder — measured against a holdout group so the brand can see real, incremental impact.",
  },
];

export function SocialProof() {
  return (
    <section id="case-study" className="scroll-mt-20 border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Illustrative example — not a real customer
        </p>
        <SectionHeading
          className="mt-5"
          title="What a single thread is built to do"
          lead="We're early and won't invent results we haven't earned. Here's the kind of outcome Threadline is designed to produce — once a real pilot delivers measured numbers, they'll replace this."
        />

        <ol className="mt-14 grid gap-0 overflow-hidden rounded-lg border border-border md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step.when}
              className="border-b border-border p-6 last:border-b-0 sm:p-8 md:border-b-0 md:border-r md:last:border-r-0"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-serif text-2xl font-medium text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {step.when}
                </span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-foreground/90">{step.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button asChild className="rounded-md">
            <Link href="/signup">
              Start your own thread
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground">Real case studies coming soon.</p>
        </div>
      </div>
    </section>
  );
}
