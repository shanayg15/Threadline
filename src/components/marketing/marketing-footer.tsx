import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { GithubMark } from "@/components/marketing/github-mark";
import { GITHUB_URL } from "@/lib/marketing/config";

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Lifecycle", href: "/#lifecycle" },
      { label: "Campaigns", href: "/#campaigns" },
      { label: "The console", href: "/#product" },
      { label: "How it compares", href: "/#compare" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "FAQ", href: "/#faq" },
      { label: "GitHub", href: GITHUB_URL },
      { label: "Book a demo", href: "/contact" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Get started", href: "/signup" },
      { label: "Sign in", href: "/login" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function MarketingFooter() {
  const year = 2026;
  return (
    <footer className="border-t bg-card/40">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <BrandLogo />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              The open-source post-purchase text concierge for Shopify brands. One thread that
              sells, supports, and brings customers back.
            </p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <GithubMark className="size-4" />
              Open source · MIT
            </a>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-sm font-semibold">{col.heading}</h3>
              <ul className="mt-3 space-y-2.5">
                {col.links.map((link) => {
                  const external = link.href.startsWith("http");
                  return (
                    <li key={link.label}>
                      {external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <p>© {year} Threadline. MIT licensed. Clones an idea, not a brand.</p>
          <p className="text-xs">
            SMS &amp; MMS today. RCS, WhatsApp &amp; iMessage on the roadmap.
          </p>
        </div>
      </div>
    </footer>
  );
}
