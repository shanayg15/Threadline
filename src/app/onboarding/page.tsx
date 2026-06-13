import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { getActiveBrand } from "@/lib/auth/brand";

export const metadata = { title: "Get set up — Threadline" };

export default async function OnboardingPage() {
  await getActiveBrand(); // protected: redirects to /login when unauthenticated

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 text-center">
      <BrandLogo className="mb-8" />
      <h1 className="text-2xl font-semibold tracking-tight">Let&apos;s set up your concierge</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        The guided setup — connect Shopify, set your brand voice, paste policies, and choose
        playbooks — arrives in M7. For now, jump straight into the console.
      </p>
      <Button asChild className="mt-6">
        <Link href="/conversations">
          Continue to console
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
