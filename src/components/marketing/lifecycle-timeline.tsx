import { SectionHeading } from "@/components/marketing/section-heading";

const STEPS = [
  {
    label: "Question",
    detail:
      "A shopper texts about fit, materials, or your return policy — and gets an associate-quality answer from your live catalog, before they bounce.",
  },
  {
    label: "Order",
    detail:
      "When they're ready, the agent recommends the confident choice and hands over a secure checkout link the customer pays. No abandoned cart.",
  },
  {
    label: "Delivery",
    detail:
      "Once the box actually arrives, Threadline checks in — heading off avoidable returns while the thread is still warm.",
  },
  {
    label: "Next purchase",
    detail:
      "Exchanges, reorders, cross-sells, and subscription saves happen right in the thread — which remembers every earlier conversation.",
  },
];

export function LifecycleTimeline() {
  return (
    <section id="lifecycle" className="scroll-mt-20 border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <SectionHeading
          title="One thread, from question to reorder"
          lead="Threadline keeps a single conversation open across the moments that decide a sale, a return, and the next purchase — instead of scattering them across separate tools."
        />

        <ol className="relative mt-16 grid gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {/* connecting line (desktop) */}
          <div
            aria-hidden
            className="absolute left-0 right-0 top-1.5 hidden h-px bg-border lg:block"
          />
          {STEPS.map((step) => (
            <li key={step.label} className="relative lg:pt-10">
              <span
                aria-hidden
                className="absolute left-0 top-0 size-3 rounded-full bg-foreground ring-4 ring-background lg:left-1/2 lg:-translate-x-1/2"
              />
              <div className="pl-7 lg:pl-0 lg:text-center">
                <h3 className="font-serif text-2xl font-medium tracking-tight">{step.label}</h3>
                <p className="mt-2 text-sm text-muted-foreground lg:mx-auto lg:max-w-[15rem]">
                  {step.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
