import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MessageSquareText } from "lucide-react";

import { GithubMark } from "@/components/marketing/github-mark";
import { GITHUB_URL } from "@/lib/marketing/config";

export const metadata: Metadata = {
  title: "Book a demo — Threadline",
  description:
    "Threadline is open source and early. Get started for free, or reach the team on GitHub.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-20 sm:px-6 lg:py-28">
      <h1 className="text-balance text-4xl font-semibold tracking-tight">Let&apos;s talk</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Threadline is open source and still early, so the fastest way to evaluate it is to run it
        yourself — the whole app works locally with mocked services, no API keys required. When
        you&apos;re ready for a real walkthrough, here&apos;s how to reach us.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/signup"
          className="group flex flex-col rounded-2xl border bg-card p-6 transition-shadow hover:shadow-md"
        >
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MessageSquareText className="size-5" />
          </span>
          <h2 className="mt-4 font-semibold">Get started now</h2>
          <p className="mt-1.5 flex-1 text-sm text-muted-foreground">
            Create an account and connect a Shopify store. Supervised mode is on by default, so
            nothing sends without your approval.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
            Create account
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>

        <a
          href={`${GITHUB_URL}/issues`}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col rounded-2xl border bg-card p-6 transition-shadow hover:shadow-md"
        >
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <GithubMark className="size-5" />
          </span>
          <h2 className="mt-4 font-semibold">Reach us on GitHub</h2>
          <p className="mt-1.5 flex-1 text-sm text-muted-foreground">
            Open an issue or a discussion with questions, ideas, or pilot interest. It&apos;s the
            most reliable way to get a response while we&apos;re early.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
            Open the repo
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </a>
      </div>

      <p className="mt-10 rounded-xl border bg-card/50 p-4 text-sm text-muted-foreground">
        Running your own deployment? Point the &ldquo;Book a demo&rdquo; button at your scheduling
        link by setting{" "}
        <code className="font-mono text-foreground">NEXT_PUBLIC_BOOK_A_DEMO_URL</code> in your
        environment.
      </p>
    </div>
  );
}
