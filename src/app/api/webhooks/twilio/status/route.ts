import { NextResponse, type NextRequest } from "next/server";

import { resolveBrandByNumber } from "@/lib/channels/resolve";
import { parseTwilioForm, twilioChannel } from "@/lib/channels/twilio";
import * as auditRepo from "@/lib/db/repos/audit";
import * as messagesRepo from "@/lib/db/repos/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapDelivery(
  status: string | undefined,
): "queued" | "sent" | "delivered" | "failed" | null {
  switch (status) {
    case "queued":
    case "accepted":
    case "sending":
      return "queued";
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "undelivered":
    case "failed":
      return "failed";
    default:
      return null;
  }
}

/** Twilio delivery-status callback: updates the message's deliveryStatus by its
 * provider message id and audits failures. */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!twilioChannel.verifySignature(req, rawBody)) {
    return new NextResponse("invalid signature", { status: 403 });
  }

  const p = parseTwilioForm(rawBody);
  const sid = p.MessageSid ?? p.SmsSid;
  const status = mapDelivery(p.MessageStatus);
  const from = p.From; // our sending number for an outbound status callback
  if (!sid || !status || !from) return NextResponse.json({ ok: true });

  const brand = await resolveBrandByNumber(from);
  if (!brand) return NextResponse.json({ ok: true, note: "unrouted number" });

  const updated = await messagesRepo.setDeliveryStatusByChannelId(brand.id, sid, status);
  if (status === "failed" && updated) {
    await auditRepo.record(brand.id, {
      actor: "system",
      action: "delivery_failed",
      targetType: "message",
      targetId: updated.id,
      payload: { sid, errorCode: p.ErrorCode ?? null },
    });
  }

  return NextResponse.json({ ok: true });
}
