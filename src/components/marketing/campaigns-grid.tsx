import { Layers, UserCog, BarChart3 } from "lucide-react";

import { SectionHeading } from "@/components/marketing/section-heading";

const BEFORE = {
  kicker: "Before purchase · Inbound",
  title: "Answer what decides the sale",
  items: [
    {
      label: "Fit & size",
      body: "Turn a sizing question into a confident pick using product fit notes, the order history, and your policies.",
    },
    {
      label: "Product matching",
      body: 'Styling, bundles, and "what goes with what" questions become grounded recommendations from the live catalog.',
    },
    {
      label: "Availability & restock",
      body: "When a variant is sold out, suggest an in-stock alternative or capture restock intent in the same thread.",
    },
    {
      label: "Shipping & policy confidence",
      body: "Delivery, exchange, return, and gifting questions answered straight from your real policies — before checkout.",
    },
  ],
};

const AFTER = {
  kicker: "After delivery · Outbound",
  title: "Show up when the box arrives",
  items: [
    {
      label: "Delivery check-in",
      body: 'A timely "how\'s it working out?" once the order is actually delivered — collecting feedback and keeping the thread alive.',
    },
    {
      label: "Exchange rescue",
      body: "When fit or expectation is off, steer toward the right alternative before the customer disappears into a return portal.",
    },
    {
      label: "Contextual cross-sell",
      body: "Recommend the genuinely useful next item from the live catalog, with full purchase context in hand.",
    },
    {
      label: "Replenishment & save",
      body: "Turn usage and cadence into a well-timed reorder, a subscription, or a save before churn — never pushy.",
    },
  ],
};

const TRIO = [
  {
    icon: Layers,
    label: "Shared context",
    body: "Every pre- and post-purchase playbook reads the same customer record, so the agent never forgets what already happened.",
  },
  {
    icon: UserCog,
    label: "Human handoff",
    body: "Unusual conversations escalate to a teammate in-thread, with the full history intact — nothing starts over.",
  },
  {
    icon: BarChart3,
    label: "Measurement",
    body: "Revenue, support outcomes, and requests stay tied to the conversation that produced them — measured against a holdout.",
  },
];

function PlaybookColumn({ col }: { col: typeof BEFORE }) {
  return (
    <div className="rounded-2xl border bg-card p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{col.kicker}</p>
      <h3 className="mt-2 text-xl font-semibold">{col.title}</h3>
      <ul className="mt-6 divide-y">
        {col.items.map((item) => (
          <li key={item.label} className="py-4 first:pt-0 last:pb-0">
            <p className="font-medium">{item.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CampaignsGrid() {
  return (
    <section id="campaigns" className="scroll-mt-20 bg-card/30">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-6 lg:py-24">
        <SectionHeading
          eyebrow="Campaigns"
          title="Eight playbooks across one thread"
          lead="The same continuous conversation runs your before-checkout and after-delivery moments — so questions, returns, and retention stop being separate workflows."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <PlaybookColumn col={BEFORE} />
          <PlaybookColumn col={AFTER} />
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {TRIO.map(({ icon: Icon, label, body }) => (
            <div key={label} className="rounded-2xl border bg-card p-6">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <h4 className="mt-4 font-semibold">{label}</h4>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
