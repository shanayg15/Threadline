/**
 * Static configuration for the public marketing site. Server-safe constants only —
 * no secrets, no DB. The "Book a demo" target is configurable via a public env var so
 * an operator can point it at their own Cal.com / scheduling link; it falls back to the
 * in-app /contact route when unset.
 */

export const GITHUB_URL = "https://github.com/shanayg15/Threadline";

/** Set NEXT_PUBLIC_BOOK_A_DEMO_URL to a scheduling link (Cal.com, etc.) to override. */
export const BOOK_A_DEMO_URL = process.env.NEXT_PUBLIC_BOOK_A_DEMO_URL || "/contact";

/** Header nav — mirrors the reference IA section set, anchored to our own sections. */
export const NAV_LINKS = [
  { label: "Lifecycle", href: "/#lifecycle" },
  { label: "Product", href: "/#product" },
  { label: "Campaigns", href: "/#campaigns" },
  { label: "Case study", href: "/#case-study" },
  { label: "Blog", href: "/blog" },
] as const;
