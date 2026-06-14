import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { GithubMark } from "@/components/marketing/github-mark";
import { PhoneThread } from "@/components/marketing/phone-thread";
import { Button } from "@/components/ui/button";
import { GITHUB_URL } from "@/lib/marketing/config";

const STRIP = ["Persistent 1:1 channel", "Grounded in your live catalog", "Works with your stack"];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* warm brand wash behind the hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary/10 via-background to-background"
      />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-20 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_minmax(0,0.9fr)] lg:gap-8 lg:pb-28 lg:pt-20">
        <div>
          <Link
            href={GITHUB_URL}
            className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <GithubMark className="size-3.5" />
            Open source · MIT · SMS-first for Shopify
          </Link>

          <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            One text thread that sells, supports, and brings customers back.
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
            Threadline gives every customer an AI associate grounded in your live catalog, policies,
            and order history — answering buying questions the moment they decide, then checking in
            after the box arrives to turn returns into exchanges and first orders into repeat ones.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">
                Get started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/#lifecycle">See how it works</Link>
            </Button>
          </div>

          <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {STRIP.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:pl-4">
          <PhoneThread />
        </div>
      </div>
    </section>
  );
}
