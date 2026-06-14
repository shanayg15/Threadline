import { NextResponse, type NextRequest } from "next/server";

import { getActiveBrand } from "@/lib/auth/brand";
import * as conversations from "@/lib/db/repos/conversations";
import * as messages from "@/lib/db/repos/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live thread poll: thread-visible messages newer than ?since= (ISO) plus the current
 * open supervised draft. Both queries are brand-scoped (the session brand), so this can
 * never return another tenant's thread even with a guessed conversation id.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { brandId } = await getActiveBrand();
  const { id } = await params;
  const sinceParam = req.nextUrl.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : new Date(0);
  const safeSince = Number.isNaN(since.getTime()) ? new Date(0) : since;

  const [newMessages, draft] = await Promise.all([
    messages.listForConversationSince(brandId, id, safeSince),
    conversations.getOpenDraft(brandId, id),
  ]);
  return NextResponse.json({ messages: newMessages, draft: draft ?? null });
}
