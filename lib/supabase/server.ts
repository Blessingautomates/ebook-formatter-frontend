import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import {
  SUPABASE_ANON_KEY,
  SUPABASE_SETUP_HINT,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "./env";

/**
 * A Supabase client for server components and route handlers.
 *
 * The session lives in cookies, so this binds the client to the request's own
 * cookie jar. In Next 15 `cookies()` is async, hence the await.
 */
export async function createClient() {
  if (!isSupabaseConfigured) throw new Error(SUPABASE_SETUP_HINT);

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // A Server Component renders with a read-only cookie jar, so a
          // refreshed token cannot be written back from here. That is fine:
          // middleware.ts runs on every request and writes it instead.
        }
      },
    },
  });
}
