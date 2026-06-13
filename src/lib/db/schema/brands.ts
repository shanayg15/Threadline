import { boolean, jsonb, pgTable, text } from "drizzle-orm/pg-core";

import { createdAt, uuidPk } from "./_shared";

/** Per-brand voice/persona used to ground the agent's tone (M6). */
export type VoiceConfig = {
  agentName: string;
  toneExemplars: string[];
  bannedPhrases: string[];
  formality: "casual" | "neutral" | "formal";
};

/** Brand policy text the agent answers from (never invents). */
export type Policies = {
  returns: string;
  shipping: string;
  exchange: string;
  other?: string;
};

/** Outbound quiet hours, applied in the customer's timezone (24h "HH:MM"). */
export type QuietHours = { start: string; end: string };

/** Outbound frequency caps per brand. */
export type FrequencyCaps = { perDay: number; perWeek: number };

/**
 * `brands` — the tenant root. Every other domain table references a brand and is
 * always queried brand-scoped. No `brandId` here (this IS the tenant).
 */
export const brands = pgTable("brands", {
  id: uuidPk(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  voiceConfig: jsonb().$type<VoiceConfig>(),
  policies: jsonb().$type<Policies>(),
  quietHours: jsonb().$type<QuietHours>(),
  frequencyCaps: jsonb().$type<FrequencyCaps>(),
  // Supervised mode: require human approval on outbound while tone is unproven.
  supervisedMode: boolean().notNull().default(true),
  channelConfig: jsonb().$type<Record<string, unknown>>(),
  createdAt: createdAt(),
});
