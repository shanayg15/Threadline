import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "@/lib/config/env";

/**
 * Symmetric encryption for integration credentials at rest (AES-256-GCM).
 *
 * Integration secrets (Shopify/Twilio/Slack tokens) are NEVER stored in plaintext —
 * `integrations.credentialsCiphertext` holds the output of {@link encrypt}. The key
 * is `env.ENCRYPTION_KEY`, validated upstream to decode to exactly 32 bytes.
 *
 * Wire format: `iv:authTag:ciphertext`, each segment base64. GCM gives us
 * authenticated encryption, so tampering fails closed on decrypt.
 */
const KEY = Buffer.from(env.ENCRYPTION_KEY, "base64");
const IV_LENGTH = 12; // 96-bit nonce, the GCM standard

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ":",
  );
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid ciphertext: expected `iv:authTag:ciphertext`");
  }
  const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
