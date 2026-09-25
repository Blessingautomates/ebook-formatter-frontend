import type { MetadataRoute } from "next";

const SITE_URL = "https://format.toolstackai.xyz";

/**
 * Emitted at /sitemap.xml — the four routes the app actually serves.
 *
 * No `lastModified`: nothing here tracks a real modification time, and stamping
 * `new Date()` on every build tells Google a page changed when it did not,
 * which erodes the signal rather than using it.
 *
 * `/dashboard` is listed even though middleware.ts redirects an anonymous
 * crawler to /login. That redirect is the honest answer to "what is at this
 * URL", and leaving it out of the sitemap would not keep it out of the index.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/signup`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/dashboard`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/login`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
