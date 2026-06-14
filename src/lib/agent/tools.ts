import { tool } from "ai";
import { z } from "zod";

import * as pendingActionsRepo from "@/lib/db/repos/pendingActions";
import * as productsRepo from "@/lib/db/repos/products";
import type { ToolContext } from "./types";

/**
 * Search results are for FINDING products/policies — never for quoting stock or price.
 * The embedded snippet can contain a snapshot price/qty line (see embeddings/pipeline);
 * strip anything price- or stock-shaped so the model physically cannot read a stale
 * number out of a search hit and must call get_variant_live. Enforces the live-only
 * invariant in code, not just in the prompt.
 */
function stripPriceStock(text: string): string {
  return text
    .replace(/\bprices?:?\s*\$?\s?\d[\d.,]*/gi, "")
    .replace(/\$\s?\d[\d.,]*/g, "")
    .replace(/\b\d+\s*(?:in stock|in inventory|units?|available|left|qty|quantity)\b/gi, "")
    .replace(/\b(?:in stock|out of stock|sold out|inventory)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * The agent's tools. Each tool has a plain implementation (also driven directly by
 * the keyless stub model) and an AI-SDK wrapper (driven by the real model's loop).
 *
 * HARD INVARIANTS enforced here, in code:
 *  - stock/price come from get_variant_live (the LIVE commerce read), never RAG;
 *  - propose_action is PROPOSE-ONLY: it writes a `pending` action and returns — it
 *    NEVER places/charges/fulfils anything (execution is M8);
 *  - escalate_to_human just records intent; the orchestrator flips the conversation.
 */
export function createTools(ctx: ToolContext) {
  const { brand, customer, conversationId, commerce, flags } = ctx;
  const mark = (name: string) => {
    if (!flags.toolsUsed.includes(name)) flags.toolsUsed.push(name);
  };

  // Side-effect stores: real repos by default, injectable for tests/evals (DB-free).
  const listVariantsFn =
    ctx.listVariants ??
    (async (productId: string) =>
      (await productsRepo.listVariants(brand.id, productId)).map((v) => ({
        variantId: v.id,
        title: v.title,
        options: v.options ?? {},
      })));
  const proposals = ctx.proposals ?? pendingActionsRepo;

  const impls = {
    async searchCatalog(args: { query: string; limit?: number }) {
      mark("search_catalog");
      const hits = await commerce.searchCatalog(brand.id, args.query, { limit: args.limit ?? 5 });
      return hits.map((h) => ({
        productId: h.productId,
        title: h.title,
        sourceType: h.sourceType,
        // Never hand stock/price back from search — the model must use get_variant_live.
        snippet: stripPriceStock(h.snippet),
      }));
    },

    /** A product's variants — identity/options only (the snapshot). NOT stock or price:
     * call get_variant_live for those. Lets the agent go from a search hit to a variant. */
    async listVariants(args: { productId: string }) {
      mark("list_variants");
      return listVariantsFn(args.productId);
    },

    async getVariantLive(args: { variantId: string }) {
      mark("get_variant_live");
      const v = await commerce.getVariantLive(brand.id, args.variantId);
      if (!v) return { found: false as const };
      return {
        found: true as const,
        variantId: v.variantId,
        title: v.title,
        priceUsd: (v.priceCents / 100).toFixed(2),
        inStock: v.available && v.inventoryQty > 0,
        inventoryQty: v.inventoryQty,
        options: v.options,
      };
    },

    async getOrderStatus(args: { orderRef: string }) {
      mark("get_order_status");
      const s = await commerce.getOrderStatus(brand.id, args.orderRef);
      if (!s) return { found: false as const };
      return {
        found: true as const,
        fulfillmentStatus: s.fulfillmentStatus,
        trackingNumber: s.trackingNumber,
        carrier: s.carrier,
        shippedAt: s.shippedAt?.toISOString() ?? null,
        deliveredAt: s.deliveredAt?.toISOString() ?? null,
      };
    },

    async getCustomerHistory() {
      mark("get_customer_history");
      const orders = await commerce.getCustomerHistory(brand.id, customer.id);
      return orders.map((o) => ({
        orderId: o.orderId,
        totalUsd: o.totalCents == null ? null : (o.totalCents / 100).toFixed(2),
        fulfillmentStatus: o.fulfillmentStatus,
        createdAt: o.createdAt.toISOString(),
      }));
    },

    /** PROPOSE-ONLY. Writes a pending action and returns. Nothing is executed. */
    async proposeAction(args: {
      type: "place_order" | "create_exchange" | "create_checkout_link" | "modify_subscription";
      summary: string;
      variantId?: string;
      quantity?: number;
      orderId?: string;
    }) {
      mark("propose_action");
      const existing = await proposals.getOpen(brand.id, conversationId);
      if (existing) {
        return {
          proposed: false as const,
          reason: "An action is already awaiting the customer's confirmation.",
          actionId: existing.id,
        };
      }
      const action = await proposals.create(brand.id, {
        conversationId,
        type: args.type,
        payload: {
          summary: args.summary,
          variantId: args.variantId ?? null,
          quantity: args.quantity ?? null,
          orderId: args.orderId ?? null,
        },
        // Abandoned proposals expire (swept by maintenance) so a stale "reply YES" can't
        // be confirmed days later against changed stock/price.
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      ctx.flags.proposedActionId = action.id;
      return {
        proposed: true as const,
        actionId: action.id,
        // The model must ASK the customer to confirm; it must NOT claim completion.
        note: "Proposed only. Ask the customer to reply YES to confirm; nothing is placed or charged yet.",
      };
    },

    async escalateToHuman(args: { reason: string }) {
      mark("escalate_to_human");
      ctx.flags.escalated = true;
      ctx.flags.escalationReason = args.reason;
      return { escalated: true as const };
    },
  };

  const ai = {
    search_catalog: tool({
      description:
        "Find relevant products or brand policies by semantic + keyword search. Returns matches to ground your answer. Does NOT return live stock or price — call get_variant_live for those.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("What to search for, e.g. 'lightweight rain jacket' or 'return policy'"),
        limit: z.number().int().min(1).max(10).optional(),
      }),
      execute: impls.searchCatalog,
    }),
    list_variants: tool({
      description:
        "List a product's variants (size/color options and their ids) so you can pick one to price-check. Identity only — does NOT include live stock or price.",
      inputSchema: z.object({ productId: z.string() }),
      execute: impls.listVariants,
    }),
    get_variant_live: tool({
      description:
        "Get the LIVE stock and price for a specific product variant, at this moment. This is the ONLY source of availability and price — always call it before quoting either.",
      inputSchema: z.object({ variantId: z.string() }),
      execute: impls.getVariantLive,
    }),
    get_order_status: tool({
      description: "Get the current fulfillment/tracking status for an order by its id.",
      inputSchema: z.object({ orderRef: z.string() }),
      execute: impls.getOrderStatus,
    }),
    get_customer_history: tool({
      description: "List this customer's recent orders (to find an order to discuss or exchange).",
      inputSchema: z.object({}),
      execute: impls.getCustomerHistory,
    }),
    propose_action: tool({
      description:
        "Propose a side effect (place an order, create an exchange, send a checkout link, or modify a subscription). PROPOSE-ONLY: this records the request and asks the customer to confirm — it does NOT place, charge, or complete anything. After calling it, ask the customer to reply YES to confirm.",
      inputSchema: z.object({
        type: z.enum([
          "place_order",
          "create_exchange",
          "create_checkout_link",
          "modify_subscription",
        ]),
        summary: z
          .string()
          .describe("A one-line, human-readable summary of what is being proposed."),
        variantId: z.string().optional(),
        quantity: z.number().int().positive().optional(),
        orderId: z.string().optional(),
      }),
      execute: impls.proposeAction,
    }),
    escalate_to_human: tool({
      description:
        "Hand the conversation to a human teammate. Use when the customer asks for a person, is confused or upset, or you are not confident you can help correctly.",
      inputSchema: z.object({ reason: z.string() }),
      execute: impls.escalateToHuman,
    }),
  };

  return { impls, ai };
}

export type AgentTools = ReturnType<typeof createTools>;
