import { createBrowserClient } from "@supabase/ssr";

import {
  SUPABASE_ANON_KEY,
  SUPABASE_SETUP_HINT,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "./env";

/**
 * A Supabase client for browser components.
 *
 * `createBrowserClient` returns the same instance for the same URL and key, so
 * this is safe to call per render and needs no module-level singleton. It reads
 * the session out of the auth cookies, which `middleware.ts` keeps fresh.
 *
 * Throws rather than returning a half-built client when the env is missing: a
 * client with an empty URL fails later, deep inside a fetch, with nothing that
 * points at the environment. Callers check `isSupabaseConfigured` first so the
 * user sees the setup steps instead of ever reaching this.
 */
export function createClient() {
  if (!isSupabaseConfigured) throw new Error(SUPABASE_SETUP_HINT);
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
