import { BrandLogo } from "@/components/brand-logo";
import { getActiveBrand } from "@/lib/auth/brand";
import * as brands from "@/lib/db/repos/brands";
import * as integrations from "@/lib/db/repos/integrations";
import * as playbooks from "@/lib/db/repos/playbooks";

import { OnboardingWizard, type OnboardingInitial } from "./onboarding-wizard";

export const metadata = { title: "Get set up — Threadline" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const ctx = await getActiveBrand(); // protected: redirects to /login when unauthenticated
  const [brand, shopify, playbookList] = await Promise.all([
    brands.getById(ctx.brandId),
    integrations.get(ctx.brandId, "shopify"),
    playbooks.list(ctx.brandId),
  ]);

  const shopDomain =
    typeof shopify?.metadata?.shopDomain === "string" ? shopify.metadata.shopDomain : null;
  const phoneNumber =
    typeof brand?.channelConfig?.phoneNumber === "string" ? brand.channelConfig.phoneNumber : null;

  const initial: OnboardingInitial = {
    voiceConfig: brand?.voiceConfig ?? null,
    policies: brand?.policies ?? null,
    quietHours: brand?.quietHours ?? null,
    frequencyCaps: brand?.frequencyCaps ?? null,
    // Fresh setup defaults supervised mode ON.
    supervisedMode: brand?.supervisedMode ?? true,
    shopifyStatus: shopify?.status ?? null,
    shopDomain,
    phoneNumber,
    playbooks: playbookList.map((p) => ({
      id: p.id,
      key: p.key,
      enabled: p.enabled,
      delayMinutes: p.delayMinutes,
    })),
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-12">
      <BrandLogo className="mb-8" />
      <div className="w-full max-w-2xl space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="font-serif text-3xl font-medium tracking-tight">
            Let&apos;s set up your concierge
          </h1>
          <p className="text-sm text-muted-foreground">
            A few quick steps and your post-purchase agent is ready to text.
          </p>
        </div>
        <OnboardingWizard initial={initial} />
      </div>
    </div>
  );
}
