import { Check } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { SectionHeading } from "@/components/marketing/section-heading";

const ROWS = [
  {
    aspect: "How it starts",
    today: "A campaign blast, a support ticket, or a customer hunting through a returns portal.",
    threadline:
      "The customer texts — or Threadline reaches out the moment delivery actually lands.",
  },
  {
    aspect: "When it shows up",
    today: "As a broadcast before the sale, or only after the customer has already escalated.",
    threadline:
      "Before checkout, after delivery, during an exchange, and ahead of the next reorder.",
  },
  {
    aspect: "What the customer feels",
    today: "One more message to ignore, a ticket queue, or a self-serve form to fill out.",
    threadline:
      "A personal thread with someone who remembers them — whether they reply now or tonight.",
  },
  {
    aspect: "What your team learns",
    today: "Open rates, ticket tags, and last-touch campaign attribution.",
    threadline:
      "Fit blockers, product confusion, buying intent, and reorder timing — in the customer's words.",
  },
  {
    aspect: "Where it resolves",
    today: "Across disconnected tools that don't share context.",
    threadline:
      "In the conversation first, with a clean handoff to the right system when it's needed.",
  },
];

export function ComparisonTable() {
  return (
    <section id="compare" className="scroll-mt-20">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-6 lg:py-24">
        <SectionHeading
          title={<>Keep your stack — Threadline covers what it can&apos;t reach</>}
          lead="Broadcast tools like Klaviyo and Attentive blast everyone at once. Helpdesks like Gorgias wait for a ticket. Returns portals like Loop kick in once the customer has already given up. Threadline opens a one-to-one text conversation — the part none of those tools are designed to begin."
        />

        {/* Desktop: aligned grid */}
        <div className="mt-12 hidden overflow-hidden rounded-2xl border sm:block">
          <div className="grid grid-cols-3 border-b bg-card">
            <div className="p-5" />
            <div className="p-5 text-sm font-semibold text-muted-foreground">Your stack today</div>
            <div className="flex items-center gap-2 bg-primary/5 p-5 text-sm font-semibold">
              <BrandLogo iconOnly />
              With Threadline
            </div>
          </div>
          {ROWS.map((row, i) => (
            <div
              key={row.aspect}
              className={`grid grid-cols-3 ${i < ROWS.length - 1 ? "border-b" : ""}`}
            >
              <div className="bg-card/40 p-5 text-sm font-semibold">{row.aspect}</div>
              <div className="p-5 text-sm text-muted-foreground">{row.today}</div>
              <div className="flex gap-2.5 bg-primary/5 p-5 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{row.threadline}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: stacked cards */}
        <div className="mt-10 space-y-4 sm:hidden">
          {ROWS.map((row) => (
            <div key={row.aspect} className="overflow-hidden rounded-xl border">
              <p className="border-b bg-card p-3 text-sm font-semibold">{row.aspect}</p>
              <div className="space-y-3 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Your stack today
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{row.today}</p>
                </div>
                <div className="rounded-lg bg-primary/5 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                    <Check className="size-3.5" /> With Threadline
                  </p>
                  <p className="mt-1 text-sm">{row.threadline}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
