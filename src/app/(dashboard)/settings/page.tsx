import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getActiveBrand } from "@/lib/auth/brand";
import * as brands from "@/lib/db/repos/brands";
import * as consent from "@/lib/db/repos/consent";
import * as customers from "@/lib/db/repos/customers";
import * as integrations from "@/lib/db/repos/integrations";
import * as playbooks from "@/lib/db/repos/playbooks";
import * as users from "@/lib/db/repos/users";
import { formatDate, formatPhone } from "@/lib/format";

import { ComplianceForm } from "./compliance-form";
import { IntegrationsPanel } from "./integrations-panel";
import { PlaybooksPanel } from "./playbooks-panel";
import { PoliciesForm } from "./policies-form";
import { TeamPanel } from "./team-panel";
import { VoiceForm } from "./voice-form";

export const metadata = { title: "Settings — Threadline" };
export const dynamic = "force-dynamic";

const TABS = [
  { value: "voice", label: "Brand voice" },
  { value: "policies", label: "Policies" },
  { value: "integrations", label: "Integrations" },
  { value: "campaigns", label: "Campaigns" },
  { value: "compliance", label: "Compliance" },
  { value: "team", label: "Team" },
  { value: "billing", label: "Billing" },
] as const;

export default async function SettingsPage() {
  const ctx = await getActiveBrand();
  const [brand, shopify, twilio, playbookList, members, customerList, optOutLog] =
    await Promise.all([
      brands.getById(ctx.brandId),
      integrations.get(ctx.brandId, "shopify"),
      integrations.get(ctx.brandId, "twilio"),
      playbooks.list(ctx.brandId),
      users.listForBrand(ctx.brandId),
      customers.list(ctx.brandId),
      consent.listForBrand(ctx.brandId, { action: "opt_out", limit: 50 }),
    ]);

  // The saved messaging number lives on the brand's channelConfig; the twilio
  // integration row corroborates a live connection when present.
  const twilioMetadataNumber =
    typeof twilio?.metadata?.phoneNumber === "string" ? twilio.metadata.phoneNumber : null;
  const channelPhone =
    (typeof brand?.channelConfig?.phoneNumber === "string"
      ? brand.channelConfig.phoneNumber
      : null) ?? twilioMetadataNumber;
  const shopDomain =
    typeof shopify?.metadata?.shopDomain === "string" ? shopify.metadata.shopDomain : null;

  const suppressionList = customerList
    .filter((c) => c.consentStatus === "opted_out")
    .map((c) => ({
      id: c.id,
      name: c.name,
      phoneE164: c.phoneE164,
      optedOutAt: c.optedOutAt ? c.optedOutAt.toISOString() : null,
    }));

  // Map customerId → phone so the opt-out log can show a number, not an id.
  const phoneById = new Map(customerList.map((c) => [c.id, c.phoneE164]));
  const optOutEntries = optOutLog.map((e) => ({
    id: e.id,
    phone: e.customerId ? (phoneById.get(e.customerId) ?? null) : null,
    source: e.source,
    rawMessage: e.rawMessage,
    createdAt: e.createdAt.toISOString(),
  }));

  const playbookRows = playbookList.map((p) => ({
    id: p.id,
    key: p.key,
    enabled: p.enabled,
    delayMinutes: p.delayMinutes,
  }));

  const memberRows = members.map((m) => ({
    id: m.id,
    email: m.email,
    name: m.name,
    role: m.role,
  }));

  return (
    <PageContainer>
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

          <TabsContent value="voice">
            <Card>
              <CardHeader>
                <CardTitle>Brand voice</CardTitle>
                <CardDescription>How your concierge sounds in customer threads.</CardDescription>
              </CardHeader>
              <CardContent>
                <VoiceForm initial={brand?.voiceConfig ?? null} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="policies">
            <Card>
              <CardHeader>
                <CardTitle>Policies</CardTitle>
                <CardDescription>The source of truth the agent answers from.</CardDescription>
              </CardHeader>
              <CardContent>
                <PoliciesForm initial={brand?.policies ?? null} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations">
            <IntegrationsPanel
              shopifyStatus={shopify?.status ?? null}
              shopDomain={shopDomain}
              phoneNumber={channelPhone}
            />
          </TabsContent>

          <TabsContent value="campaigns">
            <Card>
              <CardHeader>
                <CardTitle>Campaigns</CardTitle>
                <CardDescription>Proactive follow-up playbooks.</CardDescription>
              </CardHeader>
              <CardContent>
                <PlaybooksPanel playbooks={playbookRows} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Compliance</CardTitle>
                <CardDescription>Quiet hours, frequency caps, and supervised mode.</CardDescription>
              </CardHeader>
              <CardContent>
                <ComplianceForm
                  initial={{
                    quietHours: brand?.quietHours ?? null,
                    frequencyCaps: brand?.frequencyCaps ?? null,
                    supervisedMode: brand?.supervisedMode ?? true,
                  }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Suppression list</CardTitle>
                <CardDescription>
                  Customers who have opted out. They never receive outbound messages.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {suppressionList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No opted-out customers.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Opted out</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suppressionList.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{c.name ?? "—"}</TableCell>
                          <TableCell>{formatPhone(c.phoneE164)}</TableCell>
                          <TableCell>{formatDate(c.optedOutAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Opt-out log</CardTitle>
                <CardDescription>
                  Append-only record of opt-out events (most recent first).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {optOutEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No opt-out events recorded.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Phone</TableHead>
                        <TableHead>When</TableHead>
                        <TableHead>Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {optOutEntries.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>{e.phone ? formatPhone(e.phone) : "—"}</TableCell>
                          <TableCell>{formatDate(e.createdAt)}</TableCell>
                          <TableCell>{e.source ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team">
            <Card>
              <CardHeader>
                <CardTitle>Team</CardTitle>
                <CardDescription>People with access to this brand.</CardDescription>
              </CardHeader>
              <CardContent>
                <TeamPanel members={memberRows} canInvite={ctx.role === "owner"} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing">
            <Card>
              <CardHeader>
                <CardTitle>Billing</CardTitle>
                <CardDescription>Plans and usage are coming soon.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Billing isn&apos;t available yet. Threadline is free while in development.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
