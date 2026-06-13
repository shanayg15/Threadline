/**
 * Repository layer — thin, typed, brand-scoped data access.
 *
 * RULES (multi-tenancy is the #1 correctness risk):
 *  - Every function that touches a domain table takes `brandId` as its FIRST
 *    argument and filters by it. No exceptions.
 *  - Repos are dumb data access. Business rules (compliance, gates, quiet hours)
 *    live in services in later milestones, never here.
 *  - The append-only logs (audit, consent) expose record/read only — never update
 *    or delete.
 *
 * Import namespaced: `import { customers, conversations } from "@/lib/db/repos"`.
 */
export * as brands from "./brands";
export * as customers from "./customers";
export * as conversations from "./conversations";
export * as messages from "./messages";
export * as orders from "./orders";
export * as products from "./products";
export * as pendingActions from "./pendingActions";
export * as knowledge from "./knowledge";
export * as integrations from "./integrations";
export * as audit from "./audit";
export * as consent from "./consent";
export * as attributions from "./attributions";
