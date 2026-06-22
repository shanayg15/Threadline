import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";

/**
 * Public marketing shell — a sticky header + footer around every marketing route. These
 * routes are excluded from the auth middleware, so the whole section stays public. (The
 * editorial black-on-white theme is applied app-wide at `:root` in globals.css.)
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />

      {/* Floating contact affordance — links to our contact page (no phone number shown). */}
      <Link
        href="/contact"
        className="fixed bottom-5 right-5 z-40 hidden items-center gap-2.5 rounded-full border border-border bg-background px-4 py-2.5 text-sm shadow-lg transition-colors hover:bg-accent sm:flex"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <MessageCircle className="size-4" />
        </span>
        <span className="font-medium">Questions? Talk to us</span>
      </Link>
    </div>
  );
}
