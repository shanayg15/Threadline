import { SectionHeading } from "@/components/marketing/section-heading";

const BEFORE = {
  kicker: "Before purchase · Inbound",
  title: "Answer what decides the sale",
  lead: "The questions that decide whether a shopper buys now or leaves.",
  items: [
    {
      trigger: "Between two sizes",
      label: "Fit & size",
      body: "Turn a sizing question into a confident pick using product fit notes, order history, and your policies.",
    },
    {
      trigger: "What goes with what",
      label: "Product matching",
      body: "Styling, bundle, and comparison questions become grounded recommendations from the live catalog.",
    },
    {
      trigger: "The pick is sold out",
      label: "Availability & restock",
      body: "Suggest an in-stock alternative or capture restock intent in the same thread.",
    },
    {
      trigger: "A pre-checkout blocker",
      label: "Shipping & policy confidence",
      body: "Delivery, exchange, return, and gifting questions answered from your real policies — before checkout.",
    },
  ],
};

const AFTER = {
  kicker: "After delivery · Outbound",
  title: "Show up when the box arrives",
  lead: "Follow up when the customer has the product and the next signal is strongest.",
  items: [
    {
      trigger: "The box just landed",
      label: "Delivery check-in",
      body: 'A timely "how\'s it working out?" once the order is delivered — collecting feedback and keeping the thread alive.',
    },
    {
      trigger: "Fit or expectation is off",
      label: "Exchange rescue",
      body: "Steer toward the right alternative before the customer disappears into a return portal.",
    },
    {
      trigger: "They ask what's next",
      label: "Contextual cross-sell",
      body: "Recommend the genuinely useful next item from the live catalog, with full purchase context in hand.",
    },
    {
      trigger: "Reorder or churn signal",
      label: "Replenishment & save",
      body: "Turn usage and cadence into a well-timed reorder, a subscription, or a save before churn — never pushy.",
    },
  ],
};

const TRIO = [
  {
    label: "Shared context",
    body: "Every pre- and post-purchase playbook reads the same customer record, so the agent never forgets what already happened.",
  },
  {
    label: "Human handoff",
    body: "Unusual conversations escalate to a teammate in-thread, with the full history intact — nothing starts over.",
  },
  {
    label: "Measurement",
    body: "Revenue, support outcomes, and requests stay tied to the conversation that produced them — measured against a holdout.",
  },
];

function PlaybookColumn({ col }: { col: typeof BEFORE }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border p-6 sm:p-8">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {col.kicker}
        </p>
        <h3 className="mt-2 font-serif text-2xl font-medium tracking-tight">{col.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{col.lead}</p>
      </div>
      <ul>
        {col.items.map((item) => (
          <li
            key={item.label}
            className="grid gap-1 border-b border-border p-6 last:border-b-0 sm:grid-cols-[10rem_1fr] sm:gap-5 sm:p-8"
          >
            <p className="text-[0.7rem] font-semibold uppercase leading-relaxed tracking-[0.12em] text-muted-foreground">
              {item.trigger}
            </p>
            <div>
              <p className="font-medium">{item.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CampaignsGrid() {
  return (
    <section id="campaigns" className="scroll-mt-20 border-b border-border bg-muted/50">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <SectionHeading
          title={
            <>
              Eight playbooks,
              <br className="hidden sm:block" /> one continuous thread
            </>
          }
          lead="The same conversation runs your before-checkout and after-delivery moments — so questions, returns, and retention stop being separate workflows."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <PlaybookColumn col={BEFORE} />
          <PlaybookColumn col={AFTER} />
        </div>

        <div className="mt-12 grid gap-8 border-t border-border pt-10 sm:grid-cols-3">
          {TRIO.map((item) => (
            <div key={item.label}>
              <h4 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {item.label}
              </h4>
              <p className="mt-2 text-sm text-foreground/90">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
