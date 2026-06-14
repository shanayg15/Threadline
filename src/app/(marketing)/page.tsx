import type { Metadata } from "next";

import { BlogTeaser } from "@/components/marketing/blog-teaser";
import { CampaignsGrid } from "@/components/marketing/campaigns-grid";
import { ComparisonTable } from "@/components/marketing/comparison-table";
import { ConsoleShowcase } from "@/components/marketing/console-showcase";
import { CtaBand } from "@/components/marketing/cta-band";
import { Faq } from "@/components/marketing/faq";
import { Hero } from "@/components/marketing/hero";
import { IntegrationsStrip } from "@/components/marketing/integrations-strip";
import { LifecycleTimeline } from "@/components/marketing/lifecycle-timeline";
import { SocialProof } from "@/components/marketing/social-proof";

export const metadata: Metadata = {
  title: "Threadline — the post-purchase text concierge for Shopify brands",
  description:
    "Threadline runs one persistent SMS thread per customer, powered by an AI agent grounded in your live Shopify catalog, policies, and order history. Answer buying questions before checkout and follow up after delivery — open source, compliant, with a human handoff.",
  alternates: { canonical: "/" },
};

export default function MarketingPage() {
  return (
    <>
      <Hero />
      <IntegrationsStrip />
      <LifecycleTimeline />
      <CampaignsGrid />
      <ComparisonTable />
      <ConsoleShowcase />
      <SocialProof />
      <BlogTeaser />
      <Faq />
      <CtaBand />
    </>
  );
}
