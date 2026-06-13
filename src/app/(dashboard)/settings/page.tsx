import { Settings as SettingsIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata = { title: "Settings — Threadline" };

const TABS = [
  { value: "voice", label: "Brand voice" },
  { value: "policies", label: "Policies" },
  { value: "integrations", label: "Integrations" },
  { value: "campaigns", label: "Campaigns" },
  { value: "compliance", label: "Compliance" },
  { value: "team", label: "Team" },
] as const;

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Configure your brand, channels, and team." />
      <Tabs defaultValue="voice" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <EmptyState
              icon={SettingsIcon}
              title={`${tab.label} settings arrive in M7`}
              description="Onboarding and Settings get wired to the brand record in M7."
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
