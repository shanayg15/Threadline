import { MessageCircleQuestion, CreditCard, PackageCheck, Repeat } from "lucide-react";

import { SectionHeading } from "@/components/marketing/section-heading";

const STEPS = [
  {
    icon: MessageCircleQuestion,
    label: "Question",
    detail:
      "A shopper texts to ask about fit, materials, or your return policy — and gets an associate-quality answer grounded in your live catalog before they bounce.",
  },
  {
    icon: CreditCard,
    label: "Order",
    detail:
      "When they're ready, the agent recommends the confident choice and hands over a secure checkout link the customer pays. No abandoned cart.",
  },
  {
    icon: PackageCheck,
    label: "Delivery",
    detail:
      "Once the box actually arrives, Threadline checks in — heading off avoidable returns and surfacing the next need while the thread is still warm.",
  },
  {
    icon: Repeat,
    label: "Next purchase",
    detail:
      "Exchanges, reorders, cross-sells, and subscription saves happen right in the thread — which remembers every earlier conversation.",
  },
];

export function LifecycleTimeline() {
  return (
    <section id="lifecycle" className="scroll-mt-20">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-6 lg:py-24">
        <SectionHeading
          eyebrow="Lifecycle"
          title="One thread, from question to reorder"
          lead="Threadline keeps a single conversation open across the moments that decide a sale, a return, and the next purchase — instead of scattering them across separate tools."
        />

        <ol className="relative mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {/* connecting line (desktop) */}
          <div
            aria-hidden
            className="absolute left-0 right-0 top-6 hidden h-px bg-border lg:block"
          />
          {STEPS.map(({ icon: Icon, label, detail }, i) => (
            <li key={label} className="relative flex flex-col">
              <div className="flex items-center gap-4 lg:block">
                <span className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-primary/30 bg-card text-primary">
                  <Icon className="size-5" />
                </span>
                <div className="mt-0 lg:mt-5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Step {i + 1}
                  </span>
                  <h3 className="text-lg font-semibold">{label}</h3>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground lg:pr-2">{detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
