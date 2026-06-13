import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js configuration. This half holds NO Node-only dependencies
 * (no pg, no bcrypt), so `middleware.ts` can construct an Auth.js instance from it
 * to validate the JWT at the edge. The Credentials provider — which needs the DB
 * and bcrypt — is added only in the full instance (`./index.ts`, Node runtime).
 *
 * The jwt/session callbacks live here so both instances attach the same
 * brand-scoped claims (userId, brandId, role).
 */
export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.brandId = user.brandId;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      // JWT custom claims are typed `unknown` (Record<string, unknown>); narrow them.
      if (typeof token.userId === "string") session.user.id = token.userId;
      if (typeof token.brandId === "string") session.user.brandId = token.brandId;
      if (typeof token.role === "string") {
        session.user.role = token.role as "owner" | "agent" | "viewer";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
