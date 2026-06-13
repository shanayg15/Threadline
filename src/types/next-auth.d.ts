import { type DefaultSession } from "next-auth";

type BrandRole = "owner" | "agent" | "viewer";

declare module "next-auth" {
  /** Returned by `auth()`, exposed to server components. */
  interface Session {
    user: {
      id: string;
      brandId: string;
      role: BrandRole;
    } & DefaultSession["user"];
  }

  /** Returned by the Credentials `authorize` callback. */
  interface User {
    brandId?: string;
    role?: BrandRole;
  }
}

// NOTE: next-auth/jwt re-exports @auth/core/jwt, whose JWT extends
// Record<string, unknown>; the custom claims (userId/brandId/role) are read back
// with runtime `typeof` guards in the session callback rather than via augmentation.
