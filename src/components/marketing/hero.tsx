import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PhoneThread } from "@/components/marketing/phone-thread";
import { Button } from "@/components/ui/button";

const STRIP = ["Persistent 1:1 channel", "Grounded in your live catalog", "Works with your stack"];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-20 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[1.05fr_minmax(0,0.95fr)] lg:gap-10 lg:pb-28 lg:pt-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Open source · SMS-first for Shopify
          </p>

          <h1 className="mt-6 text-balance font-serif text-5xl font-medium leading-[1.04] tracking-tight sm:text-6xl">
            One text thread that sells, supports, and brings customers back.
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
            Threadline gives every customer an AI associate grounded in your live catalog, policies,
            and order history — answering buying questions the moment they decide, then checking in
            after the box arrives to turn returns into exchanges and first orders into repeat ones.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="rounded-md">
              <Link href="/signup">
                Get started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-md">
              <Link href="/#lifecycle">See how it works</Link>
            </Button>
          </div>

          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {STRIP.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="size-1 rounded-full bg-foreground" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:pl-6">
          <PhoneThread />
        </div>
      </div>
    </section>
  );
}
