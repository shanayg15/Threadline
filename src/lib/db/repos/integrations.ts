import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { decrypt, encrypt } from "@/lib/db/crypto";
import { integrations, type integrationKind, type integrationStatus } from "@/lib/db/schema";
import { one } from "./_util";

export type Integration = typeof integrations.$inferSelect;

type Kind = (typeof integrationKind.enumValues)[number];
type Status = (typeof integrationStatus.enumValues)[number];

/**
 * Insert or update a brand's integration of a given kind, atomically. Credentials
 * are encrypted before storage (AES-256-GCM) and never written in plaintext. The
 * unique (brandId, kind) index backs the ON CONFLICT, so concurrent upserts can't
 * create duplicates.
 */
export async function upsert(
  brandId: string,
  kind: Kind,
  params: {
    credentials?: Record<string, unknown> | string;
    metadata?: Record<string, unknown>;
    status?: Status;
  },
): Promise<Integration> {
  const credentialsCiphertext =
    params.credentials === undefined
      ? undefined
      : encrypt(
          typeof params.credentials === "string"
            ? params.credentials
            : JSON.stringify(params.credentials),
        );

  return one(
    await db
      .insert(integrations)
      .values({
        brandId,
        kind,
        credentialsCiphertext,
        metadata: params.metadata,
        status: params.status ?? "connected",
      })
      .onConflictDoUpdate({
        target: [integrations.brandId, integrations.kind],
        set: {
          ...(credentialsCiphertext !== undefined ? { credentialsCiphertext } : {}),
          ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
          ...(params.status !== undefined ? { status: params.status } : {}),
          updatedAt: new Date(),
        },
      })
      .returning(),
  );
}

export async function get(brandId: string, kind: Kind): Promise<Integration | undefined> {
  const rows = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.brandId, brandId), eq(integrations.kind, kind)))
    .limit(1);
  return rows[0];
}

/** Read an integration's credentials, decrypted. Returns undefined if not set. */
export async function getDecryptedCredentials(
  brandId: string,
  kind: Kind,
): Promise<string | undefined> {
  const row = await get(brandId, kind);
  if (!row?.credentialsCiphertext) return undefined;
  return decrypt(row.credentialsCiphertext);
}

export async function setStatus(
  brandId: string,
  kind: Kind,
  status: Status,
): Promise<Integration | undefined> {
  const rows = await db
    .update(integrations)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(integrations.brandId, brandId), eq(integrations.kind, kind)))
    .returning();
  return rows[0];
}
