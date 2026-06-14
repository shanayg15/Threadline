import { ChevronDown } from "lucide-react";

import { SectionHeading } from "@/components/marketing/section-heading";

/**
 * FAQ accordion. Built on native <details>/<summary> so it's keyboard-accessible and
 * expands/collapses with zero client JS (and degrades gracefully without motion).
 * Every answer is original and accurate to what Threadline actually does.
 */

const FAQS: { q: string; a: string }[] = [
  {
    q: "How does Threadline actually work?",
    a: "Each customer gets one persistent text thread. An AI agent — grounded in your live Shopify catalog, policies, and the customer's order history — answers inbound questions in your brand's voice and sends proactive check-ins after delivery. Anything unusual escalates to a human in the same thread.",
  },
  {
    q: "Which channels can it use today?",
    a: "SMS and MMS today, so customers can even send a photo of a fit or defect. RCS, WhatsApp, and iMessage sit behind a swappable channel adapter and are on the roadmap. We lead with SMS because it supports compliant, business-initiated messaging on every phone.",
  },
  {
    q: "How does it connect to my Shopify store?",
    a: "You connect your store during onboarding and Threadline syncs your catalog, customers, and orders. Crucially, stock and price are read live at answer time — never from a stale snapshot — so the agent never promises a sold-out variant.",
  },
  {
    q: "How are consent and compliance handled?",
    a: "As deterministic code, never by the model. STOP/HELP/START keywords, per-number suppression, quiet hours in the customer's timezone, and frequency caps are all enforced before the agent is ever called, and consent changes are logged. (This isn't legal advice — SMS is regulated, so confirm the specifics with counsel.)",
  },
  {
    q: "Can the agent charge a customer's card?",
    a: 'No. Money always flows through a Shopify checkout link or draft-order invoice the customer pays themselves — there\'s no card-on-file charging. Any purchase or exchange waits behind an explicit, unambiguous in-thread "yes" tied to that specific proposal.',
  },
  {
    q: "What keeps the agent from saying the wrong thing?",
    a: "A critique pass blocks invented discounts, made-up policies, and over-promises before a reply is ever sent. While you're building trust, supervised mode holds every outbound message for a teammate to approve, edit, or reject.",
  },
  {
    q: "How do you measure results honestly?",
    a: "Customers are split into a treatment group and a holdout that's never proactively messaged. Orders are attributed back to the conversation that assisted them, so you compare against the holdout instead of crediting every sale that happens near a link.",
  },
  {
    q: "What happens when a conversation gets tricky?",
    a: "It escalates to a teammate inside the same thread with the full history intact — nothing starts over. You can pause the agent with one tap and take over from the console at any time.",
  },
  {
    q: "Is it really open source?",
    a: "Yes — MIT licensed. The whole app runs locally with mocked external services, so you can exercise the full inbound-to-reply loop without any API keys, then add real Shopify, Twilio, and LLM credentials when you're ready.",
  },
  {
    q: "How does pricing work?",
    a: "Threadline is open source, so you can self-host it. A hosted option is planned and intended to be priced around engaged conversations and proven lift rather than raw message volume.",
  },
  {
    q: "How is my data handled?",
    a: "Every brand's data is scoped to that brand throughout the app. Integration credentials are encrypted at rest, and the audit and consent logs are append-only.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 bg-card/30">
      <div className="mx-auto w-full max-w-3xl px-5 py-20 sm:px-6 lg:py-24">
        <SectionHeading eyebrow="FAQ" title="Questions, answered" />

        <div className="mt-10 divide-y rounded-2xl border bg-card">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="group px-5 py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <p className="pb-4 pr-9 text-sm text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
