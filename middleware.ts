import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Runs before every matched request to refresh the Supabase session and keep
 * `/dashboard` behind a sign-in. The work itself lives in lib/supabase, so the
 * rule can be read in one place next to the redirects it performs.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /*
   * Everything except:
   *
   * - `/api/*`, which next.config.mjs rewrites to the FastAPI backend. Those
   *   endpoints know nothing about a Supabase session, so refreshing one on the
   *   way past would cost a round trip per upload and change nothing.
   * - Next's own build output and the image optimiser.
   * - Anything with a file extension: favicon.ico, robots.txt, sitemap.xml and
   *   the static files under public/, including the Google Search Console
   *   verification file (googleb2fe224c3810ab6e.html). A browser or a crawler
   *   requests these anonymously, and bouncing them to /login would replace the
   *   asset with an HTML page.
   */
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|html|txt|xml|json|css|js|map|woff|woff2|ttf|otf)$).*)",
  ],
};
