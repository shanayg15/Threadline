/**
 * Channel abstraction so SMS/MMS (Twilio today) is interchangeable with RCS,
 * WhatsApp, or iMessage later. The core never depends on a specific provider.
 */

export type OutboundMessage = {
  to: string;
  body: string;
  mediaUrls?: string[];
};

export type InboundMessage = {
  from: string;
  to: string;
  body: string;
  mediaUrls: string[];
  providerMessageId: string;
  raw: unknown;
};

export type SendResult = {
  providerMessageId: string;
  status: "queued" | "sent" | "failed";
};

export type ChannelKind = "sms" | "mms" | "rcs" | "whatsapp" | "imessage";

export interface Channel {
  readonly kind: ChannelKind;
  /** Send an outbound message. In dev (SEND_REAL_SMS=false) this is mocked. */
  send(msg: OutboundMessage): Promise<SendResult>;
  /** Verify the provider's request signature against the raw body + URL. */
  verifySignature(req: Request, rawBody: string): boolean;
  /** Verify + normalize an inbound webhook into an InboundMessage. */
  parseInbound(req: Request, rawBody: string): InboundMessage;
}
