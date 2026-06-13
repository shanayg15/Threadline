import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth/config";

// Edge-safe instance (no DB/bcrypt) — only validates the signed JWT.
const { auth } = NextAuth(authConfig);

// Everything in the console + onboarding requires a session.
const PROTECTED_PREFIXES = [
  "/conversations",
  "/analytics",
  "/customers",
  "/orders",
  "/products",
  "/settings",
  "/onboarding",
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default auth((req) => {
  const { pathname, origin } = req.nextUrl;
  const authed = Boolean(req.auth?.user?.brandId);

  if (isProtected(pathname) && !authed) {
    const url = new URL("/login", origin);
    url.searchParams.set("callbackUrl", pathname);
    return Response.redirect(url);
  }

  // Already signed in? Don't show the auth pages.
  if (authed && (pathname === "/login" || pathname === "/signup")) {
    return Response.redirect(new URL("/conversations", origin));
  }
});

// Run on page routes only. API routes (webhooks, health, auth) and static assets
// are excluded — webhooks/health are PUBLIC and protected API routes enforce auth
// in their own handlers via getActiveBrand().
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
