import type { Plan } from "./paddle/webhook";

import { createClient } from "./supabase/client";

export type { Plan };

/**
 * Data access for the signed-in account's plan.
 *
 * One row per account, keyed by `user_id`. Nothing here writes: the row is
 * created and updated by the Paddle webhook, through the service-role client,
 * because an account that could set its own plan would have no reason to pay.
 * The `select` policy in supabase/schema.sql is scoped to the owner, which is
 * what lets this read work with the anon key the browser holds.
 *
 * `Plan` is declared in lib/paddle/webhook.ts, next to the statuses it is
 * derived from, and re-exported here so the UI has one name to import. The
 * import above is type-only, so nothing that imports this module pulls
 * `node:crypto` into the browser bundle.
 */
export interface SubscriptionRecord {
  user_id: string;
  plan: Plan;
  /** Paddle's own status: `active`, `trialing`, `past_due`, `canceled`, … */
  status: string;
  paddle_subscription_id: string | null;
  paddle_customer_id: string | null;
  price_id: string | null;
  /** End of the paid period. Set by the subscription events, not the transaction. */
  current_period_end: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Named rather than `select *`, so a column added later cannot leak silently. */
const COLUMNS = [
  "user_id",
  "plan",
  "status",
  "paddle_subscription_id",
  "paddle_customer_id",
  "price_id",
  "current_period_end",
  "canceled_at",
  "created_at",
  "updated_at",
].join(",");

/**
 * The signed-in account's subscription, or null when it has none.
 *
 * Null is the ordinary state for an account that has never upgraded, and it is
 * what a failed read is *not* allowed to look like — the subscription is only
 * ever consulted to grant something, so a read that failed is raised and left
 * for the caller to show. Supabase reports failures as a value rather than
 * throwing, hence the explicit check.
 */
export async function getMySubscription(): Promise<SubscriptionRecord | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select(COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load your plan: ${error.message}`);
  }
  return (data ?? null) as SubscriptionRecord | null;
}
