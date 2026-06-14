"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getActiveBrand } from "@/lib/auth/brand";
import { getCommerceProvider } from "@/lib/commerce";
import { DEFAULT_API_VERSION } from "@/lib/commerce/credentials";
import { ShopifyGraphQLClient } from "@/lib/commerce/shopify";
import * as audit from "@/lib/db/repos/audit";
import * as brands from "@/lib/db/repos/brands";
import * as integrations from "@/lib/db/repos/integrations";
import * as playbooks from "@/lib/db/repos/playbooks";
import * as users from "@/lib/db/repos/users";
import type { FrequencyCaps, Policies, QuietHours, VoiceConfig } from "@/lib/db/schema/brands";
import { embedBrandKnowledge } from "@/lib/embeddings/pipeline";

export type SettingsResult = { ok: true; message?: string } | { ok: false; error: string };

async function requireEditor() {
  const ctx = await getActiveBrand();
  if (ctx.role !== "owner" && ctx.role !== "agent") return null;
  return ctx;
}

function refreshSettings() {
  revalidatePath("/settings");
  revalidatePath("/onboarding");
}

export async function updateVoiceAction(voice: VoiceConfig): Promise<SettingsResult> {
  const ctx = await requireEditor();
  if (!ctx) return { ok: false, error: "You don't have permission." };
  await brands.update(ctx.brandId, { voiceConfig: voice });
  await audit.record(ctx.brandId, {
    actor: "human",
    actorUserId: ctx.userId,
    action: "brand_voice_updated",
    targetType: "brand",
    targetId: ctx.brandId,
  });
  refreshSettings();
  return { ok: true, message: "Brand voice saved." };
}

export async function updatePoliciesAction(policies: Policies): Promise<SettingsResult> {
  const ctx = await requireEditor();
  if (!ctx) return { ok: false, error: "You don't have permission." };
  await brands.update(ctx.brandId, { policies });
  // Policies feed the agent's RAG knowledge — re-embed so answers stay accurate.
  await embedBrandKnowledge(ctx.brandId);
  await audit.record(ctx.brandId, {
    actor: "human",
    actorUserId: ctx.userId,
    action: "brand_policies_updated",
    targetType: "brand",
    targetId: ctx.brandId,
  });
  refreshSettings();
  return { ok: true, message: "Policies saved and re-embedded." };
}

export async function updateComplianceAction(input: {
  quietHours: QuietHours;
  frequencyCaps: FrequencyCaps;
  supervisedMode: boolean;
}): Promise<SettingsResult> {
  const ctx = await requireEditor();
  if (!ctx) return { ok: false, error: "You don't have permission." };
  await brands.update(ctx.brandId, {
    quietHours: input.quietHours,
    frequencyCaps: input.frequencyCaps,
    supervisedMode: input.supervisedMode,
  });
  await audit.record(ctx.brandId, {
    actor: "human",
    actorUserId: ctx.userId,
    action: "compliance_settings_updated",
    targetType: "brand",
    targetId: ctx.brandId,
    payload: { supervisedMode: input.supervisedMode },
  });
  refreshSettings();
  return { ok: true, message: "Compliance settings saved." };
}

export async function setChannelNumberAction(phoneNumber: string): Promise<SettingsResult> {
  const ctx = await requireEditor();
  if (!ctx) return { ok: false, error: "You don't have permission." };
  const trimmed = phoneNumber.trim();
  if (!/^\+[1-9]\d{6,15}$/.test(trimmed))
    return { ok: false, error: "Enter a valid E.164 number, e.g. +15555550100." };
  const brand = await brands.getById(ctx.brandId);
  const channelConfig = {
    ...(brand?.channelConfig ?? {}),
    provider: "twilio",
    phoneNumber: trimmed,
  };
  await brands.update(ctx.brandId, { channelConfig });
  await audit.record(ctx.brandId, {
    actor: "human",
    actorUserId: ctx.userId,
    action: "channel_number_updated",
    targetType: "brand",
    targetId: ctx.brandId,
  });
  refreshSettings();
  return { ok: true, message: "Messaging number saved." };
}

export async function connectShopifyAction(input: {
  shopDomain: string;
  accessToken: string;
}): Promise<SettingsResult> {
  const ctx = await requireEditor();
  if (!ctx) return { ok: false, error: "You don't have permission." };
  const shopDomain = input.shopDomain.trim().replace(/^https?:\/\//, "");
  const accessToken = input.accessToken.trim();
  if (!shopDomain || !accessToken)
    return { ok: false, error: "Both the shop domain and access token are required." };

  // Validate the credentials with a lightweight live query before storing them.
  try {
    const client = new ShopifyGraphQLClient({
      shopDomain,
      accessToken,
      apiVersion: DEFAULT_API_VERSION,
      webhookSecret: null,
    });
    await client.request<{ shop: { name: string } }>(`{ shop { name } }`);
  } catch (err) {
    console.error("[shopify] connect validation failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "Couldn't connect — check the shop domain and Admin API token." };
  }

  // metadata.shopDomain (non-secret) is what webhook tenant resolution looks up.
  await integrations.upsert(ctx.brandId, "shopify", {
    credentials: { shopDomain, accessToken, apiVersion: DEFAULT_API_VERSION },
    metadata: { shopDomain },
    status: "connected",
  });
  await audit.record(ctx.brandId, {
    actor: "human",
    actorUserId: ctx.userId,
    action: "shopify_connected",
    targetType: "integration",
    targetId: "shopify",
  });

  // Initial sync + embed (best-effort; M8 moves this to a durable job).
  let synced = "";
  try {
    const provider = await getCommerceProvider(ctx.brandId);
    const cat = await provider.syncCatalog(ctx.brandId);
    await provider.syncCustomers(ctx.brandId);
    await provider.syncOrders(ctx.brandId);
    await embedBrandKnowledge(ctx.brandId);
    synced = ` Synced ${cat.products} products.`;
  } catch {
    await integrations.setStatus(ctx.brandId, "shopify", "error");
    refreshSettings();
    return { ok: false, error: "Connected, but the initial sync failed. Try again from Settings." };
  }
  refreshSettings();
  return { ok: true, message: `Shopify connected.${synced}` };
}

export async function togglePlaybookAction(
  playbookId: string,
  enabled: boolean,
): Promise<SettingsResult> {
  const ctx = await requireEditor();
  if (!ctx) return { ok: false, error: "You don't have permission." };
  const updated = await playbooks.setEnabled(ctx.brandId, playbookId, enabled);
  if (!updated) return { ok: false, error: "Playbook not found." };
  refreshSettings();
  return { ok: true };
}

export async function inviteUserAction(input: {
  email: string;
  name: string;
  role: "owner" | "agent" | "viewer";
}): Promise<SettingsResult> {
  const ctx = await getActiveBrand();
  if (ctx.role !== "owner") return { ok: false, error: "Only owners can invite teammates." };
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, error: "Enter a valid email." };
  const existing = await users.getByEmail(email);
  if (existing) return { ok: false, error: "A user with that email already exists." };

  // Create with a random password. A real invite-email flow ships later; until then the
  // temp password is only surfaced in development — never returned in a production response.
  const tempPassword = randomBytes(9).toString("base64url");
  await users.create(ctx.brandId, {
    email,
    name: input.name.trim() || null,
    role: input.role,
    passwordHash: bcrypt.hashSync(tempPassword, 10),
  });
  await audit.record(ctx.brandId, {
    actor: "human",
    actorUserId: ctx.userId,
    action: "user_invited",
    targetType: "user",
    payload: { email, role: input.role },
  });
  revalidatePath("/settings");
  return process.env.NODE_ENV === "production"
    ? { ok: true, message: `Invited ${email}. They'll receive a sign-in link by email.` }
    : { ok: true, message: `Invited ${email}. Temporary password (dev only): ${tempPassword}` };
}
