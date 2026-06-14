import type { MetadataRoute } from "next";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep the authed console + API out of the index.
      disallow: [
        "/api/",
        "/conversations",
        "/analytics",
        "/customers",
        "/orders",
        "/products",
        "/settings",
        "/onboarding",
        "/login",
        "/signup",
      ],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
