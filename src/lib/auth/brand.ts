import { redirect } from "next/navigation";

import { auth } from "./index";

export type BrandRole = "owner" | "agent" | "viewer";
export type ActiveBrand = {
  brandId: string;
  userId: string;
  role: BrandRole;
  name: string | null;
  email: string | null;
};

/**
 * The server-side source of truth for the active tenant. Every dashboard server
 * component and server action calls this and passes `brandId` into repos.
 *
 * NEVER accept a brandId from client input — that is a tenant-isolation hole.
 * Unauthenticated callers are redirected to /login.
 */
export async function getActiveBrand(): Promise<ActiveBrand> {
  const session = await auth();
  if (!session?.user?.brandId) {
    redirect("/login");
  }
  return {
    brandId: session.user.brandId,
    userId: session.user.id,
    role: session.user.role,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
  };
}
