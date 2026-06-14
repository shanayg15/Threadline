import { randomUUID } from "node:crypto";

import twilio from "twilio";

import { env } from "@/lib/config/env";
import type { Channel, InboundMessage, OutboundMessage, SendResult } from "./types";

/** Parse Twilio's application/x-www-form-urlencoded body into a flat params map. */
export function parseTwilioForm(rawBody: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(rawBody)) params[k] = v;
  return params;
}

/** The public URL Twilio signed — honor proxy/tunnel forwarding headers. */
export function twilioRequestUrl(req: Request): string {
  const parsed = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? parsed.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? parsed.host;
  return `${proto}://${host}${parsed.pathname}${parsed.search}`;
}

function mapStatus(status: string | null | undefined): SendResult["status"] {
  if (status === "failed" || status === "undelivered") return "failed";
  if (status === "sent" || status === "delivered") return "sent";
  return "queued";
}

/**
 * Twilio SMS/MMS channel adapter.
 *
 * HARD GATE: when SEND_REAL_SMS=false we do NOT call Twilio — we return a mock
 * provider id so all of dev runs end-to-end without real sends or A2P 10DLC. The
 * caller still persists the outbound message; this only governs the carrier call.
 */
export class TwilioChannel implements Channel {
  readonly kind = "sms" as const;

  async send(msg: OutboundMessage): Promise<SendResult> {
    if (!env.SEND_REAL_SMS) {
      return { providerMessageId: `mock_${randomUUID()}`, status: "sent" };
    }
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
      throw new Error("SEND_REAL_SMS=true but TWILIO_ACCOUNT_SID/AUTH_TOKEN are not set");
    }

    const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    const sender = env.TWILIO_MESSAGING_SERVICE_SID
      ? { messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID }
      : { from: env.TWILIO_FROM_NUMBER };

    const created = await client.messages.create({
      to: msg.to,
      body: msg.body,
      statusCallback: `${env.APP_URL}/api/webhooks/twilio/status`,
      ...(msg.mediaUrls && msg.mediaUrls.length > 0 ? { mediaUrl: msg.mediaUrls } : {}),
      ...sender,
    });

    return { providerMessageId: created.sid, status: mapStatus(created.status) };
  }

  verifySignature(req: Request, rawBody: string): boolean {
    if (!env.TWILIO_AUTH_TOKEN) return false;
    const signature = req.headers.get("x-twilio-signature");
    if (!signature) return false;
    return twilio.validateRequest(
      env.TWILIO_AUTH_TOKEN,
      signature,
      twilioRequestUrl(req),
      parseTwilioForm(rawBody),
    );
  }

  parseInbound(_req: Request, rawBody: string): InboundMessage {
    const p = parseTwilioForm(rawBody);
    const numMedia = Number.parseInt(p.NumMedia ?? "0", 10) || 0;
    const mediaUrls: string[] = [];
    for (let i = 0; i < numMedia; i++) {
      const url = p[`MediaUrl${i}`];
      if (url) mediaUrls.push(url);
    }
    return {
      from: p.From ?? "",
      to: p.To ?? "",
      body: p.Body ?? "",
      mediaUrls,
      providerMessageId: p.MessageSid ?? p.SmsSid ?? "",
      raw: p,
    };
  }
}

export const twilioChannel = new TwilioChannel();
