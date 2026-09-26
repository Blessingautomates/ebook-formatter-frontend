import { createAdminClient } from "@/lib/supabase/admin";

import { PADDLE_PRO_PRICE_ID } from "./env";
import {
  subscriptionUpdateFor,
  type PaddleEvent,
  type PaddleSubscriptionUpdate,
} from "./webhook";

/**
 * The server half of the Paddle integration: the signing secret, and the
 * provisioning run a verified notification performs.
 *
 * This is the only module that writes a subscription row. Nothing client-side
 * imports it — it reaches the service-role key in lib/supabase/admin.ts, which
 * bypasses the row-level security that keeps one account's data away from
 * another's.
 */

/**
 * The endpoint's signing secret (`pdl_ntfset_…`), from Paddle → Developer
 * Tools → Notifications.
 *
 * Server-only, and never `NEXT_PUBLIC_`. Whoever holds this can sign any
 * notification they like, and a forged `transaction.completed` is a free
 * subscription — so it must not be inlined into a bundle the browser
 * downloads.
 */
export const PADDLE_WEBHOOK_SECRET = (
  process.env.PADDLE_WEBHOOK_SECRET ?? ""
).trim();

export interface ProvisionOutcome {
  /** `written` when a row changed; `ignored` when the notification implied none. */
  action: "written" | "ignored";
  /** For the log line. Never sent to Paddle. */
  reason: string;
  userId: string | null;
}

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Find the account a notification is about when it did not name one.
 *
 * The pricing modal sends the user id as checkout `customData`, and Paddle
 * copies custom data from the transaction onto the subscription it creates — so
 * in the ordinary flow this is never reached. It is here for the deliveries
 * that arrive without it: a checkout completed from the Paddle dashboard by
 * hand, or a subscription created before this app passed custom data at all.
 *
 * Errors are raised rather than treated as "no match". A lookup that failed
 * because the database was unreachable says nothing about whether the account
 * exists, and answering `ignored` to it would acknowledge the notification and
 * throw the event away.
 */
async function findUserId(
  supabase: AdminClient,
  update: PaddleSubscriptionUpdate,
): Promise<string | null> {
  if (update.paddleSubscriptionId) {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("paddle_subscription_id", update.paddleSubscriptionId)
      .limit(1);
    if (error) throw new Error(error.message);
    if (data?.[0]?.user_id) return data[0].user_id as string;
  }

  if (update.paddleCustomerId) {
    // `limit(1)`, not `maybeSingle()`: the customer column has no unique
    // constraint, and maybeSingle turns two matching rows into an error.
    const { data, error } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("paddle_customer_id", update.paddleCustomerId)
      .limit(1);
    if (error) throw new Error(error.message);
    if (data?.[0]?.user_id) return data[0].user_id as string;
  }

  return null;
}

/**
 * Apply a notification to the subscriptions table.
 *
 * Written as an update followed by an insert when nothing matched, rather than
 * an `upsert`, because the two events that provision a new subscription —
 * `transaction.completed` and `subscription.created` — carry different subsets
 * of the row. An upsert would have to name every column and would write nulls
 * over the ones the event in hand knows nothing about; updating only the fields
 * the event actually carries leaves the rest as they were.
 *
 * Throws on a database failure, which the route turns into a 500 so Paddle
 * retries. Every write here is idempotent — it states the fields it knows in
 * full — so a redelivery lands the row in the same place as the first attempt.
 */
export async function provisionSubscription(
  event: PaddleEvent,
): Promise<ProvisionOutcome> {
  const update = subscriptionUpdateFor(event, {
    proPriceId: PADDLE_PRO_PRICE_ID,
  });

  if (!update) {
    return {
      action: "ignored",
      reason: `${event.event_type ?? "an unrecognised event"} changes nothing`,
      userId: null,
    };
  }

  const supabase = createAdminClient();
  const userId = update.userId ?? (await findUserId(supabase, update));

  if (!userId) {
    return {
      action: "ignored",
      reason: "no account could be matched to the notification",
      userId: null,
    };
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .update(update.fields)
    .eq("user_id", userId)
    .select("user_id");

  if (error) throw new Error(error.message);
  if (data && data.length > 0) {
    return { action: "written", reason: "updated an existing row", userId };
  }

  const { error: insertError } = await supabase
    .from("subscriptions")
    .insert({ user_id: userId, ...update.fields });

  if (!insertError) {
    return { action: "written", reason: "created the row", userId };
  }

  // 23505 is a unique violation on the primary key: the row was created between
  // the update and this insert, by the other delivery for the same checkout.
  // Both events are in flight within milliseconds of each other, so this is the
  // expected way to lose that race rather than an error. Re-running the update
  // applies these fields to the row the other delivery just made.
  if (insertError.code === "23505") {
    const { error: retryError } = await supabase
      .from("subscriptions")
      .update(update.fields)
      .eq("user_id", userId);
    if (retryError) throw new Error(retryError.message);
    return { action: "written", reason: "updated a concurrently created row", userId };
  }

  // 23503 is a foreign key violation, and here it means one thing: there is no
  // auth.users row for this id. The account was deleted between paying and this
  // delivery arriving. There is nothing left to provision and nothing a retry
  // would change, so the notification is acknowledged instead of failing until
  // Paddle gives up on it.
  if (insertError.code === "23503") {
    return {
      action: "ignored",
      reason: "the account no longer exists",
      userId,
    };
  }

  throw new Error(insertError.message);
}
