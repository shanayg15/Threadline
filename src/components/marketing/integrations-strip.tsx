import {
  MessageSquare,
  Image as ImageIcon,
  MessagesSquare,
  Smartphone,
  ShoppingBag,
  Headphones,
  Mail,
  Truck,
  Hash,
} from "lucide-react";

/**
 * "Works with your stack" strip. Neutral monochrome icons + text labels (nominative use —
 * no scraped brand marks). Channels are tagged honestly: SMS/MMS ships today; the richer
 * channels are clearly marked as roadmap.
 */

const CHANNELS_TODAY = [
  { label: "SMS", icon: MessageSquare },
  { label: "MMS", icon: ImageIcon },
];

const CHANNELS_ROADMAP = [
  { label: "RCS", icon: MessagesSquare },
  { label: "WhatsApp", icon: MessagesSquare },
  { label: "iMessage", icon: Smartphone },
];

const INTEGRATIONS = [
  { label: "Shopify", icon: ShoppingBag },
  { label: "Gorgias", icon: Headphones },
  { label: "Listrak", icon: Mail },
  { label: "EasyPost", icon: Truck },
  { label: "Slack", icon: Hash },
];

function Pill({ label, icon: Icon }: { label: string; icon: typeof MessageSquare }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium text-foreground/80">
      <Icon className="size-4 text-muted-foreground" />
      {label}
    </span>
  );
}

export function IntegrationsStrip() {
  return (
    <section className="border-y bg-card/30">
      <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Works with your stack
        </p>

        <div className="mt-6 flex flex-col items-center gap-6">
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {CHANNELS_TODAY.map((c) => (
              <Pill key={c.label} {...c} />
            ))}
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wider text-primary">
              Available today
            </span>
            <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
            {CHANNELS_ROADMAP.map((c) => (
              <Pill key={c.label} {...c} />
            ))}
            <span className="rounded-full bg-muted px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
              On the roadmap
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {INTEGRATIONS.map((i) => (
              <Pill key={i.label} {...i} />
            ))}
            <span className="inline-flex items-center rounded-full px-3 py-1.5 text-sm text-muted-foreground">
              + more via adapters
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
