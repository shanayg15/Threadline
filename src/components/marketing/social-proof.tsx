import { ArrowRight, Sparkles } from "lucide-react";
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
    <section id="case-study" className="scroll-mt-20">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-6 lg:py-24">
        <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-8 sm:p-12">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" />
              Illustrative example — not a real customer
            </span>
          </div>

          <SectionHeading
            align="left"
            className="mt-6"
            title="What a thread is built to do"
            lead="We're early and won't invent results we haven't earned. Here's the kind of outcome Threadline is designed to produce — once a real pilot delivers measured numbers, they'll replace this."
          />

          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.when} className="rounded-xl border bg-background/70 p-5">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {step.when}
                  </span>
                </div>
                <p className="mt-3 text-sm text-foreground/90">{step.text}</p>
              </li>
            ))}
          </ol>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild>
              <Link href="/signup">
                Start your own thread
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground">Real case studies coming soon.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
