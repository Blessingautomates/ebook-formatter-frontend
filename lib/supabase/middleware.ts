import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

/** Routes that need a signed-in user. */
const PROTECTED_PREFIXES = ["/dashboard"];

/** Routes a signed-in user has no reason to see. */
const AUTH_ROUTES = new Set(["/login", "/signup"]);

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function redirectTo(
  request: NextRequest,
  pathname: string,
  next?: string,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (next) url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

/**
 * A redirect built here starts as a bare response, so any cookie the Supabase
 * client just refreshed has to be copied onto it. Dropping them would sign the
 * user out on the very request that renewed their token.
 */
function carryingCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) to.cookies.set(cookie);
  return to;
}

/**
 * Refresh the session and gate the protected routes.
 *
 * Server Components cannot write cookies, so a token that expires mid-session
 * would never be renewed if this ran only in pages. Middleware can write them,
 * and it runs before every matched request, which is why the refresh lives
 * here. The `getUser` call below is also what makes this a real gate: it asks
 * the auth server, rather than trusting the cookie.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (!isSupabaseConfigured) {
    // Fail closed. Without a project there is no way to tell a signed-in user
    // from an anonymous one, and assuming "signed in" would hand the formatter
    // to anyone who asked for it.
    return isProtected(pathname)
      ? redirectTo(request, "/login", pathname)
      : NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser, not getSession: getSession only decodes the cookie, so a forged
  // one would read as a signed-in user. This validates it with the auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected(pathname)) {
    return carryingCookies(response, redirectTo(request, "/login", pathname));
  }

  if (user && AUTH_ROUTES.has(pathname)) {
    return carryingCookies(response, redirectTo(request, "/dashboard"));
  }

  return response;
}
