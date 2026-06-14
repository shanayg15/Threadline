"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ComplianceForm } from "@/app/(dashboard)/settings/compliance-form";
import { IntegrationsPanel } from "@/app/(dashboard)/settings/integrations-panel";
import { PlaybooksPanel } from "@/app/(dashboard)/settings/playbooks-panel";
import { PoliciesForm } from "@/app/(dashboard)/settings/policies-form";
import { VoiceForm } from "@/app/(dashboard)/settings/voice-form";
import type { FrequencyCaps, Policies, QuietHours, VoiceConfig } from "@/lib/db/schema/brands";
import { cn } from "@/lib/utils";

export type OnboardingInitial = {
  voiceConfig: VoiceConfig | null;
  policies: Policies | null;
  quietHours: QuietHours | null;
  frequencyCaps: FrequencyCaps | null;
  supervisedMode: boolean;
  shopifyStatus: string | null;
  shopDomain: string | null;
  phoneNumber: string | null;
  playbooks: Array<{ id: string; key: string; enabled: boolean; delayMinutes: number | null }>;
};

const STEPS = [
  { title: "Connect Shopify", description: "Ground the agent in your live store." },
  { title: "Messaging number", description: "The number your concierge texts from." },
  { title: "Brand voice", description: "How your concierge sounds." },
  { title: "Policies", description: "What the agent answers from." },
  { title: "Playbooks & compliance", description: "Proactive follow-ups and guardrails." },
] as const;

const TOTAL = STEPS.length;

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step.title} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary text-primary",
                !done && !active && "border-muted-foreground/30 text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            {i < TOTAL - 1 ? (
              <span
                className={cn(
                  "h-px flex-1",
                  i < current ? "bg-primary" : "bg-muted-foreground/30",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function OnboardingWizard({ initial }: { initial: OnboardingInitial }) {
  const router = useRouter();
  const [step, setStep] = useState(0);

  function next() {
    setStep((s) => Math.min(s + 1, TOTAL - 1));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function finish() {
    router.push("/conversations");
  }

  const current = STEPS[step];

  return (
    <Card className="w-full">
      <CardHeader className="space-y-4">
        <Stepper current={step} />
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Step {step + 1} of {TOTAL}
          </p>
          <CardTitle>{current?.title}</CardTitle>
          <CardDescription>{current?.description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 0 ? (
          <div className="space-y-4">
            <IntegrationsPanel
              shopifyStatus={initial.shopifyStatus}
              shopDomain={initial.shopDomain}
              phoneNumber={initial.phoneNumber}
              onConnected={next}
            />
            <div className="flex justify-between">
              <span />
              <Button variant="ghost" onClick={next}>
                Skip for now
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Keyless dev uses the mock provider — you can connect a real store later.
            </p>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <IntegrationsPanel
              shopifyStatus={initial.shopifyStatus}
              shopDomain={initial.shopDomain}
              phoneNumber={initial.phoneNumber}
              onNumberSaved={next}
            />
            <div className="flex justify-between">
              <Button variant="outline" onClick={back}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button variant="ghost" onClick={next}>
                Skip for now
              </Button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <VoiceForm
              initial={initial.voiceConfig}
              onSaved={next}
              submitLabel="Save & continue"
            />
            <div className="flex justify-start">
              <Button variant="outline" onClick={back}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <PoliciesForm
              initial={initial.policies}
              onSaved={next}
              submitLabel="Save & continue"
            />
            <div className="flex justify-start">
              <Button variant="outline" onClick={back}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-6">
            <PlaybooksPanel playbooks={initial.playbooks} />
            <ComplianceForm
              initial={{
                quietHours: initial.quietHours,
                frequencyCaps: initial.frequencyCaps,
                // Supervised mode defaults ON for a fresh setup.
                supervisedMode: initial.supervisedMode,
              }}
              onSaved={finish}
              submitLabel="Finish setup"
            />
            <div className="flex justify-between">
              <Button variant="outline" onClick={back}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button variant="ghost" onClick={finish}>
                Skip to console
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
