import type { MetadataRoute } from "next";

const SITE_URL = "https://format.toolstackai.xyz";

/**
 * Emitted at /robots.txt.
 *
 * `/api/*` is rewritten to the FastAPI backend by next.config.mjs and `/auth/*`
 * is the OAuth callback; neither serves a page a crawler should index. Page
 * access is governed by `allow`: /, /login and /signup are the public routes,
 * and /dashboard is left crawlable because it answers with a redirect to /login
 * rather than with anything private.
 *
 * `host` is the non-standard directive Yandex reads; Google ignores it and uses
 * the sitemap below.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/signup"],
      disallow: ["/api/", "/auth/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
