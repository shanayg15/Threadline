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
    <section id="compare" className="scroll-mt-20 border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <SectionHeading
          title={
            <>
              Keep your stack.
              <br className="hidden sm:block" /> We cover the gap it leaves open.
            </>
          }
          lead="Broadcast tools like Klaviyo and Attentive blast everyone at once. Helpdesks like Gorgias wait for a ticket. Returns portals like Loop kick in once the customer has already given up. Threadline opens the one-to-one text conversation none of those tools were built to begin."
        />

        {/* Desktop: aligned grid */}
        <div className="mt-14 hidden overflow-hidden rounded-lg border border-border sm:block">
          <div className="grid grid-cols-[1fr_1.4fr_1.4fr]">
            <div className="border-b border-border p-5" />
            <div className="border-b border-border p-5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Your stack today
            </div>
            <div className="border-b border-foreground bg-primary p-5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground">
              With Threadline
            </div>
            {ROWS.map((row, i) => {
              const last = i === ROWS.length - 1;
              return (
                <div key={row.aspect} className="contents">
                  <div
                    className={`p-5 text-sm font-medium ${last ? "" : "border-b border-border"}`}
                  >
                    {row.aspect}
                  </div>
                  <div
                    className={`p-5 text-sm text-muted-foreground ${last ? "" : "border-b border-border"}`}
                  >
                    {row.today}
                  </div>
                  <div
                    className={`border-l-2 border-foreground bg-muted/40 p-5 text-sm ${last ? "" : "border-b"}`}
                  >
                    {row.threadline}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile: stacked cards */}
        <div className="mt-12 space-y-4 sm:hidden">
          {ROWS.map((row) => (
            <div key={row.aspect} className="overflow-hidden rounded-lg border border-border">
              <p className="border-b border-border bg-muted/50 p-3 text-sm font-medium">
                {row.aspect}
              </p>
              <div className="space-y-3 p-4">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Your stack today
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{row.today}</p>
                </div>
                <div className="border-l-2 border-foreground bg-muted/40 p-3">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em]">
                    With Threadline
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
