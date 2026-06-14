import { createHmac } from "node:crypto";

import twilio from "twilio";
import { describe, expect, it } from "vitest";

import { TwilioChannel, parseTwilioForm } from "./twilio";

const channel = new TwilioChannel();

function form(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

describe("parseInbound", () => {
  it("maps From/To/Body and collects NumMedia media urls", () => {
    const body = form({
      From: "+15551230001",
      To: "+15557654321",
      Body: "does this run small?",
      MessageSid: "SM123",
      NumMedia: "2",
      MediaUrl0: "https://media/0.jpg",
      MediaUrl1: "https://media/1.jpg",
    });
    const inbound = channel.parseInbound(
      new Request("https://x/api/webhooks/twilio/inbound"),
      body,
    );
    expect(inbound.from).toBe("+15551230001");
    expect(inbound.to).toBe("+15557654321");
    expect(inbound.body).toBe("does this run small?");
    expect(inbound.providerMessageId).toBe("SM123");
    expect(inbound.mediaUrls).toEqual(["https://media/0.jpg", "https://media/1.jpg"]);
  });

  it("handles a no-media inbound", () => {
    const inbound = channel.parseInbound(
      new Request("https://x"),
      form({ From: "+1", To: "+2", Body: "hi", MessageSid: "SM1", NumMedia: "0" }),
    );
    expect(inbound.mediaUrls).toEqual([]);
  });
});

describe("send — SEND_REAL_SMS gate", () => {
  it("returns a mock provider id without calling Twilio (dev default)", async () => {
    // .env has SEND_REAL_SMS=false for local/test.
    const result = await channel.send({ to: "+15551230001", body: "hello" });
    expect(result.providerMessageId).toMatch(/^mock_/);
    expect(result.status).toBe("sent");
  });
});

describe("Twilio request signature validation", () => {
  const token = "test_auth_token";
  const url = "https://example.com/api/webhooks/twilio/inbound";
  const params = { From: "+15551230001", To: "+15557654321", Body: "STOP" };

  // Twilio's documented signing: base64(HMAC-SHA1(token, url + sorted(k+v concatenations))).
  const sign = (u: string, p: Record<string, string>) =>
    createHmac("sha1", token)
      .update(
        u +
          Object.keys(p)
            .sort()
            .map((k) => k + p[k])
            .join(""),
      )
      .digest("base64");

  it("accepts a correctly-signed request", () => {
    expect(twilio.validateRequest(token, sign(url, params), url, params)).toBe(true);
  });
  it("rejects a tampered body", () => {
    const tampered = { ...params, Body: "buy it for me" };
    expect(twilio.validateRequest(token, sign(url, params), url, tampered)).toBe(false);
  });
  it("rejects a different URL", () => {
    expect(twilio.validateRequest(token, sign(url, params), `${url}?x=1`, params)).toBe(false);
  });
});

describe("parseTwilioForm", () => {
  it("decodes urlencoded params", () => {
    expect(parseTwilioForm("From=%2B15551230001&Body=hi+there")).toEqual({
      From: "+15551230001",
      Body: "hi there",
    });
  });
});
