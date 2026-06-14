"use server";

import { revalidatePath } from "next/cache";

import { getActiveBrand } from "@/lib/auth/brand";
import { deliverHeldDraft, sendOutbound } from "@/lib/channels/outbound";
import * as audit from "@/lib/db/repos/audit";
import * as brands from "@/lib/db/repos/brands";
import * as conversations from "@/lib/db/repos/conversations";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Map a raw compliance/send reason to operator-facing copy. */
function blockMessage(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes("opted out"))
    return "This customer has opted out — you can't text them until they reply START.";
  if (r.includes("quiet hours"))
    return "It's quiet hours in the customer's local timezone right now.";
  if (r.includes("not opted in")) return "This customer hasn't opted in to messages yet.";
  if (r.includes("cap")) return "This conversation has reached its message frequency cap.";
  if (r.includes("send failed")) return "The message failed to send. Please try again.";
  return reason;
}

function canMutate(role: string): boolean {
  return role === "owner" || role === "agent";
}

async function loadSendContext(brandId: string, conversationId: string) {
  const convo = await conversations.getWithMessages(brandId, conversationId);
  if (!convo || !convo.customer) return null;
  const brand = await brands.getById(brandId);
  if (!brand) return null;
  return {
    customer: convo.customer,
    sendBrand: { id: brand.id, quietHours: brand.quietHours, frequencyCaps: brand.frequencyCaps },
    sendCustomer: {
      id: convo.customer.id,
      phoneE164: convo.customer.phoneE164,
      consentStatus: convo.customer.consentStatus,
      timezone: convo.customer.timezone,
    },
  };
}

function revalidate(conversationId: string) {
  revalidatePath(`/conversations/${conversationId}`);
  revalidatePath("/conversations");
}

/** Toggle the thread between the AI and a human operator. Returning to AI also un-escalates. */
export async function setAssigneeAction(
  conversationId: string,
  type: "ai" | "human",
): Promise<ActionResult> {
  const { brandId, userId, role } = await getActiveBrand();
  if (!canMutate(role)) return { ok: false, error: "You don't have permission to do that." };

  await conversations.setAssignee(brandId, conversationId, {
    type,
    userId: type === "human" ? userId : null,
  });
  if (type === "ai") await conversations.setStatus(brandId, conversationId, "automated");
  await audit.record(brandId, {
    actor: "human",
    actorUserId: userId,
    action: type === "human" ? "assigned_to_human" : "returned_to_ai",
    targetType: "conversation",
    targetId: conversationId,
  });
  revalidate(conversationId);
  return { ok: true };
}

/** Pause/resume the agent on a thread (paused threads get no auto-reply or proactive send). */
export async function setPausedAction(
  conversationId: string,
  paused: boolean,
): Promise<ActionResult> {
  const { brandId, userId, role } = await getActiveBrand();
  if (!canMutate(role)) return { ok: false, error: "You don't have permission to do that." };
  await conversations.setPaused(brandId, conversationId, paused);
  await audit.record(brandId, {
    actor: "human",
    actorUserId: userId,
    action: paused ? "conversation_paused" : "conversation_resumed",
    targetType: "conversation",
    targetId: conversationId,
  });
  revalidate(conversationId);
  return { ok: true };
}

/** Resolve an escalation: hand the thread back to the AI as automated. */
export async function resolveAction(conversationId: string): Promise<ActionResult> {
  const { brandId, userId, role } = await getActiveBrand();
  if (!canMutate(role)) return { ok: false, error: "You don't have permission to do that." };
  await conversations.setStatus(brandId, conversationId, "automated");
  await conversations.setAssignee(brandId, conversationId, { type: "ai", userId: null });
  await audit.record(brandId, {
    actor: "human",
    actorUserId: userId,
    action: "conversation_resolved",
    targetType: "conversation",
    targetId: conversationId,
  });
  revalidate(conversationId);
  return { ok: true };
}

/** A human operator sends a reply — still subject to compliance (opt-out blocks it). */
export async function sendHumanReplyAction(
  conversationId: string,
  body: string,
): Promise<ActionResult> {
  const { brandId, userId, role } = await getActiveBrand();
  if (!canMutate(role)) return { ok: false, error: "You don't have permission to do that." };
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Message is empty." };

  const ctx = await loadSendContext(brandId, conversationId);
  if (!ctx) return { ok: false, error: "Conversation not found." };

  // A human reply in a customer thread is treated as a reply (quiet-hours/caps exempt),
  // but opt-out is still absolute — a human clicking Send cannot text an opted-out number.
  const result = await sendOutbound(ctx.sendBrand, ctx.sendCustomer, conversationId, trimmed, {
    sender: "human",
    isReply: true,
  });
  if (!result.sent) return { ok: false, error: blockMessage(result.reason) };

  await conversations.setAssignee(brandId, conversationId, { type: "human", userId });
  await audit.record(brandId, {
    actor: "human",
    actorUserId: userId,
    action: "human_reply_sent",
    targetType: "conversation",
    targetId: conversationId,
  });
  revalidate(conversationId);
  return { ok: true };
}

/** Approve (optionally after editing) a supervised draft → send it. Still compliance-gated. */
export async function approveDraftAction(
  conversationId: string,
  draftId: string,
  editedBody?: string,
): Promise<ActionResult> {
  const { brandId, userId, role } = await getActiveBrand();
  if (!canMutate(role)) return { ok: false, error: "You don't have permission to do that." };

  const draft = await conversations.getDraftById(brandId, draftId);
  if (!draft || draft.approvalStatus !== "pending")
    return { ok: false, error: "This draft was already handled." };

  const ctx = await loadSendContext(brandId, conversationId);
  if (!ctx) return { ok: false, error: "Conversation not found." };

  const original = (draft.body ?? "").trim();
  const body = (editedBody ?? draft.body ?? "").trim();
  if (!body) return { ok: false, error: "Message is empty." };
  const edited = editedBody !== undefined && body !== original;

  const result = await deliverHeldDraft(
    ctx.sendBrand,
    ctx.sendCustomer,
    conversationId,
    { id: draft.id, model: draft.model, costCents: draft.costCents },
    body,
    { sender: edited ? "human" : "ai", approvedByUserId: userId },
  );
  if (!result.sent) return { ok: false, error: blockMessage(result.reason) };

  await audit.record(brandId, {
    actor: "human",
    actorUserId: userId,
    action: edited ? "draft_edited" : "draft_approved",
    targetType: "message",
    targetId: draftId,
    payload: { conversationId },
  });
  revalidate(conversationId);
  return { ok: true };
}

/** Reject a supervised draft (kept for audit, never sent). */
export async function rejectDraftAction(
  conversationId: string,
  draftId: string,
): Promise<ActionResult> {
  const { brandId, userId, role } = await getActiveBrand();
  if (!canMutate(role)) return { ok: false, error: "You don't have permission to do that." };
  const rejected = await conversations.rejectDraft(brandId, draftId, userId);
  if (!rejected) return { ok: false, error: "This draft was already handled." };
  await audit.record(brandId, {
    actor: "human",
    actorUserId: userId,
    action: "draft_rejected",
    targetType: "message",
    targetId: draftId,
    payload: { conversationId },
  });
  revalidate(conversationId);
  return { ok: true };
}
