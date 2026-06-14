import { NextResponse, type NextRequest } from "next/server";

import { getActiveBrand } from "@/lib/auth/brand";
import * as conversations from "@/lib/db/repos/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["automated", "escalated", "blocked", "closed"] as const;
const ACTIVITIES = ["all", "has_reply", "scheduled"] as const;

function oneOf<T extends readonly string[]>(value: string | null, allowed: T): T[number] | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T[number]) : undefined;
}

/** The conversation inbox for the signed-in brand, filtered by ?status= and ?activity=.
 * Brand is derived from the session — never the client. Polled by the console list pane. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { brandId } = await getActiveBrand();
  const sp = req.nextUrl.searchParams;
  const rows = await conversations.listForInbox(brandId, {
    status: oneOf(sp.get("status"), STATUSES),
    activity: oneOf(sp.get("activity"), ACTIVITIES),
  });
  return NextResponse.json({ conversations: rows });
}
