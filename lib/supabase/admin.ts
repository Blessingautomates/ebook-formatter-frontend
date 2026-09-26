import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_URL } from "./env";

/**
 * A Supabase client that bypasses row-level security.
 *
 * **Server-only, and only for the Paddle webhook.** Read both halves of that.
 *
 * RLS is the only thing protecting these tables, and the anon key that the
 * browser holds is public by design — so a client built with the service-role
 * key would hand every row to anyone who could reach it. Nothing under
 * components/, and nothing reachable from a `"use client"` module, may import
 * this file.
 *
 * The webhook is the one caller that legitimately needs it. A notification
 * arrives from Paddle with no cookie and no session, so `auth.uid()` is null
 * and there is no user for a policy to match. The row it writes — the plan —
 * is also one the account must not be able to write for itself: a user who
 * could update their own subscription row would not need to pay. So
 * supabase/schema.sql grants `select` on `subscriptions` and nothing else, and
 * the only writer is this client, behind a verified Paddle signature.
 *
 * The key is read here rather than in lib/supabase/env.ts so that the module
 * holding the browser's configuration does not also name the key that must
 * never reach the browser. It is deliberately *not* a `NEXT_PUBLIC_` variable:
 * Next inlines those into the client bundle, and this one would go with them.
 */

export const SUPABASE_SERVICE_ROLE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
).trim();

export const isSupabaseAdminConfigured = Boolean(
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY,
);

export const SUPABASE_ADMIN_SETUP_HINT =
  "The Supabase service-role key is not configured. Set " +
  "SUPABASE_SERVICE_ROLE_KEY in .env.local — Project Settings → API → " +
  "service_role — so the Paddle webhook can write subscription rows.";

/**
 * `persistSession: false` because there is no user to keep a session for, and
 * `autoRefreshToken: false` because a background timer refreshing a token in a
 * serverless function would outlive the request that created it.
 */
export function createAdminClient() {
  if (!isSupabaseAdminConfigured) throw new Error(SUPABASE_ADMIN_SETUP_HINT);

  return createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
