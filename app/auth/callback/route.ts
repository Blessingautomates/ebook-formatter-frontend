import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/redirects";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Where Supabase returns the browser after a Google sign-in or an emailed link.
 *
 * The PKCE flow hands back a one-time `code`, which has to be exchanged for a
 * session on the server. The session then lands in cookies, which is what
 * middleware.ts reads on the next request — so this route is the handover
 * between "the user proved who they are" and "this browser is signed in".
 *
 * Failures redirect to /login with a short code rather than a message: the
 * wording belongs in the page that renders it, not in a URL that ends up in
 * the browser's history and in any referrer header.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!isSupabaseConfigured || !code) {
    return NextResponse.redirect(`${origin}/login?error=signin_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=signin_failed`);
  }

  // `next` is a site-relative path, checked by safeNextPath above.
  return NextResponse.redirect(`${origin}${next}`);
}
