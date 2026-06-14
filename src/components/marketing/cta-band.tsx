import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { GithubMark } from "@/components/marketing/github-mark";
import { Button } from "@/components/ui/button";
import { BOOK_A_DEMO_URL, GITHUB_URL } from "@/lib/marketing/config";

export function CtaBand() {
  return (
    <section className="px-5 pb-20 sm:px-6 lg:pb-28">
      <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border bg-foreground px-6 py-14 text-center text-background sm:px-12 sm:py-20">
        <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Keep the conversation going after checkout
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-background/70">
          Connect your Shopify store, set your voice, and let one text thread sell, support, and
          bring customers back — with compliance and a human handoff built in.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" variant="secondary">
            <Link href="/signup">
              Get started
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background"
          >
            <a href={BOOK_A_DEMO_URL}>Book a demo</a>
          </Button>
        </div>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 text-sm text-background/70 transition-colors hover:text-background"
        >
          <GithubMark className="size-4" />
          Star it on GitHub — it&apos;s open source
        </a>
      </div>
    </section>
  );
}
