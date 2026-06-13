import Link from "next/link";
import { ArrowRight, MessageSquareText, PackageCheck, Repeat, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const GITHUB_URL = "https://github.com/shanayg15/Threadline";

/** Inline GitHub mark — lucide-react dropped brand icons in v1. */
function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57C20.565 21.795 24 17.31 24 12c0-6.63-5.37-12-12-12Z" />
    </svg>
  );
}

const lifecycle = [
  { label: "Question", detail: "Fit, sizing & policy answers before checkout" },
  { label: "Order", detail: "Grounded in the live catalog and order history" },
  { label: "Delivery", detail: "“The box arrived — how’s it fit?”" },
  { label: "Next", detail: "Exchanges, reorders & cross-sells in-thread" },
];

const values = [
  {
    icon: PackageCheck,
    title: "Prevent & convert returns",
    body: "Show up with associate-quality fit and care guidance before a return ever starts — and steer the rest toward an exchange.",
  },
  {
    icon: Repeat,
    title: "Grow repeat revenue",
    body: "Contextual cross-sells, reorders and subscription saves inside a thread that remembers the whole relationship.",
  },
  {
    icon: ShieldCheck,
    title: "Trust by construction",
    body: "Deterministic STOP/HELP compliance, human handoff with full context, and honest lift-vs-holdout measurement.",
  },
];

export default function MarketingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MessageSquareText className="h-4 w-4" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Threadline</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-6 pb-16 pt-12 sm:pt-20">
          <Badge variant="secondary" className="mb-5 rounded-full font-medium">
            Open source · SMS-first · Shopify
          </Badge>
          <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            Keep the conversation going after checkout.
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            Threadline is an open-source AI concierge that runs one persistent text thread per
            customer — answering fit and policy questions before checkout, then following up after
            delivery to turn returns into exchanges and one-time buyers into regulars.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                <GithubMark className="h-4 w-4" />
                View on GitHub
              </a>
            </Button>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-16">
          <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
            {lifecycle.map((step, i) => (
              <div key={step.label} className="bg-card p-5">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  {step.label}
                </div>
                <p className="mt-2 text-sm text-foreground">{step.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-20">
          <div className="grid gap-4 md:grid-cols-3">
            {values.map(({ icon: Icon, title, body }) => (
              <Card key={title} className="border-border/70">
                <CardContent className="pt-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-sm text-muted-foreground sm:flex-row">
          <p>MIT licensed · Open source · Clones an idea, not a brand.</p>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-foreground"
          >
            <GithubMark className="h-4 w-4" />
            shanayg15/Threadline
          </a>
        </div>
      </footer>
    </div>
  );
}
