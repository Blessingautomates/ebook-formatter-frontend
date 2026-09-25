/**
 * Supabase configuration, read in one place so every entry point agrees on
 * whether the project has been set up.
 *
 * These are `NEXT_PUBLIC_` variables, so Next inlines them into the client
 * bundle as well as the server one — which is what lets the browser talk to
 * Supabase directly. The anon key is *designed* to be public: it identifies the
 * project, and row-level security is what actually protects the rows. The
 * service-role key must never be used here, and must never be named
 * `NEXT_PUBLIC_`.
 *
 * The two are read as literals rather than through a helper like
 * `process.env[name]`. Next replaces the literal expression at build time, so a
 * computed lookup would come back `undefined` in the browser.
 */

export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
export const SUPABASE_ANON_KEY = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
).trim();

export const SUPABASE_SETUP_HINT =
  "Supabase is not configured. Copy .env.example to .env.local, set " +
  "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from your " +
  "project's API settings, and run supabase/schema.sql against it.";

/**
 * Whether the project is configured at all.
 *
 * Supabase backs the sign-in and the saved-projects list, not the formatting
 * itself, so a missing key is a setup step rather than a reason to crash. Every
 * caller checks this first and shows {@link SUPABASE_SETUP_HINT} instead of
 * calling into a client that cannot work.
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
