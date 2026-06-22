import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { GithubMark } from "@/components/marketing/github-mark";
import { Button } from "@/components/ui/button";
import { BOOK_A_DEMO_URL, GITHUB_URL } from "@/lib/marketing/config";

export function CtaBand() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-5 py-24 text-center sm:px-8 lg:py-32">
        <h2 className="mx-auto max-w-3xl text-balance font-serif text-4xl font-medium leading-[1.06] tracking-tight sm:text-5xl">
          Keep the conversation going after checkout
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
          Connect your Shopify store, set your voice, and let one text thread sell, support, and
          bring customers back — with compliance and a human handoff built in.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="rounded-md">
            <Link href="/signup">
              Get started
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-md">
            <a href={BOOK_A_DEMO_URL}>Book a demo</a>
          </Button>
        </div>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <GithubMark className="size-4" />
          Star it on GitHub — it&apos;s open source
        </a>
      </div>
    </section>
  );
}
