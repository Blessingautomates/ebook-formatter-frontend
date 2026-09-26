import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Paddle webhook verification, and the translation from a notification to the
 * fields the subscriptions row should carry.
 *
 * Deliberately pure: it reads the raw body and the signature header and returns
 * what to write. It touches neither Supabase nor the request lifecycle, so the
 * part with security consequences — deciding whether a request really came from
 * Paddle — can be tested on its own. `scripts/test-paddle-webhook.mjs` does,
 * and the route handler in app/api/webhooks/paddle/route.ts is left with the
 * plumbing.
 *
 * The `node:crypto` import is why the route declares the Node runtime, and why
 * nothing client-side may import this module.
 */

/**
 * How old a signature may be before it is refused.
 *
 * Paddle signs the *timestamp* along with the body, so without a bound a
 * captured notification would stay replayable forever. Five minutes is Paddle's
 * own suggestion and is far longer than the delivery delay between their
 * servers and ours, so a legitimate event cannot fall outside it.
 */
export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

/** A plan is a single boolean in disguise; the row stores it as text. */
export type Plan = "free" | "pro";

export interface PaddleSignature {
  /** Unix seconds, as claimed by the sender. */
  ts: number;
  /**
   * Every `h1` in the header. Paddle sends one, but a secret rotation can
   * produce a header carrying two during the overlap, and refusing that would
   * drop valid events for the length of the rotation.
   */
  h1: string[];
}

/**
 * Read a `Paddle-Signature` header: `ts=1699999999;h1=abc…`.
 *
 * Returns null for anything that does not carry at least one timestamp and one
 * digest, which the caller turns into a rejection. Unrecognised keys are
 * ignored rather than rejected, so a field Paddle adds later cannot break
 * delivery.
 */
export function parsePaddleSignature(header: string): PaddleSignature | null {
  let ts: number | null = null;
  const h1: string[] = [];

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;

    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!value) continue;

    if (key === "ts") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) ts = parsed;
    } else if (key === "h1") {
      h1.push(value);
    }
  }

  if (ts === null || h1.length === 0) return null;
  return { ts, h1 };
}

/**
 * Whether a notification really came from Paddle.
 *
 * The digest is HMAC-SHA256 over `"{ts}:{rawBody}"`, keyed with the endpoint's
 * signing secret. Two details matter and are easy to get wrong:
 *
 * - It must be the *raw* body. Re-serialising parsed JSON reorders keys and
 *   changes whitespace, and every signature would fail. The caller reads the
 *   body once, as text, and only parses it after this returns true.
 * - The comparison is `timingSafeEqual`, so the digest cannot be recovered a
 *   byte at a time from how long the check takes.
 */
export function verifyPaddleSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  nowMs: number = Date.now(),
): boolean {
  if (!header || !secret) return false;

  const signature = parsePaddleSignature(header);
  if (!signature) return false;

  // Absolute difference, so a timestamp far in the future is refused too. A
  // clock that is wrong in either direction is not a reason to trust a claim.
  const age = Math.abs(nowMs / 1000 - signature.ts);
  if (age > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret)
    .update(`${signature.ts}:${rawBody}`)
    .digest();

  return signature.h1.some((candidate) => {
    // Odd-length or non-hex input silently truncates, hence the length check
    // rather than trusting `Buffer.from` to throw.
    const received = Buffer.from(candidate, "hex");
    return (
      received.length === expected.length && timingSafeEqual(received, expected)
    );
  });
}

/**
 * The columns a notification is allowed to write.
 *
 * Only the keys a given event actually knows about are ever set. That is what
 * lets the writer update an existing row without blanking the columns the event
 * said nothing about — a `transaction.completed` carries no billing period, and
 * writing `null` over the period an earlier `subscription.created` stored would
 * lose the renewal date.
 */
export interface SubscriptionFields {
  plan: Plan;
  status: string;
  paddle_subscription_id?: string;
  paddle_customer_id?: string;
  price_id?: string;
  current_period_end?: string;
  canceled_at?: string;
}

export interface PaddleSubscriptionUpdate {
  /**
   * The account the checkout was opened for, or null when the notification did
   * not name one. The caller falls back to matching an existing row by
   * subscription or customer id.
   */
  userId: string | null;
  /** Keys for that fallback, both null when the event did not carry them. */
  paddleSubscriptionId: string | null;
  paddleCustomerId: string | null;
  fields: SubscriptionFields;
}

/** The notifications this endpoint acts on. Everything else is acknowledged and ignored. */
export const HANDLED_EVENT_TYPES = [
  "transaction.completed",
  "subscription.created",
  "subscription.updated",
  "subscription.canceled",
] as const;

export interface PaddleEvent {
  event_id?: string;
  event_type?: string;
  data?: Record<string, unknown>;
}

/**
 * Subscription statuses that still carry Pro.
 *
 * `past_due` is included on purpose. A failed renewal does not end a
 * subscription — Paddle retries the payment for a couple of weeks before
 * cancelling — so revoking access on the first declined charge would take the
 * formatter away from someone whose card merely expired, over a hiccup Paddle
 * is still resolving. Remove it from this set to cut access at the first
 * failure instead.
 */
const PRO_STATUSES = new Set(["active", "trialing", "past_due"]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** The first line item's price id, which is the plan that was bought. */
function firstPriceId(data: Record<string, unknown>): string | null {
  const items = Array.isArray(data.items) ? data.items : [];
  for (const item of items) {
    const id = asString(asRecord(asRecord(item).price).id);
    if (id) return id;
  }
  return null;
}

/**
 * The Supabase account a checkout was opened for, taken from the `customData`
 * the pricing modal sends. Anything that is not a uuid is treated as absent
 * rather than passed to Postgres, where it would fail the insert with a type
 * error that says nothing about where the value came from.
 */
function userIdFrom(data: Record<string, unknown>): string | null {
  const candidate = asString(asRecord(data.custom_data).user_id);
  return candidate && UUID.test(candidate) ? candidate : null;
}

/**
 * Translate a notification into the write it implies, or null when it implies
 * none.
 *
 * Null is the common case — most notifications are about things this app does
 * not model — and the caller acknowledges those with a 200 so Paddle stops
 * retrying. It is also what a retry gets: every write below is a full statement
 * of the fields it knows, so applying the same notification twice lands the row
 * in the same place as applying it once.
 *
 * `proPriceId` is only consulted for a completed transaction that names no
 * subscription. A checkout that was misconfigured as a one-off payment still
 * has to grant Pro to someone who has just paid for it; a one-off payment for
 * anything else must not.
 */
export function subscriptionUpdateFor(
  event: PaddleEvent | null | undefined,
  options: { proPriceId?: string } = {},
): PaddleSubscriptionUpdate | null {
  const data = event?.data;
  if (!event || !data || typeof data !== "object") return null;

  const paddleCustomerId = asString(data.customer_id);
  const userId = userIdFrom(data);

  if (event.event_type === "transaction.completed") {
    const paddleSubscriptionId = asString(data.subscription_id);
    const priceId = firstPriceId(data);

    const isSubscription = paddleSubscriptionId !== null;
    const isProPrice = options.proPriceId
      ? priceId === options.proPriceId
      : false;
    if (!isSubscription && !isProPrice) return null;

    const fields: SubscriptionFields = { plan: "pro", status: "active" };
    if (paddleSubscriptionId) {
      fields.paddle_subscription_id = paddleSubscriptionId;
    }
    if (paddleCustomerId) fields.paddle_customer_id = paddleCustomerId;
    if (priceId) fields.price_id = priceId;

    return { userId, paddleSubscriptionId, paddleCustomerId, fields };
  }

  const isSubscriptionEvent =
    event.event_type === "subscription.created" ||
    event.event_type === "subscription.updated" ||
    event.event_type === "subscription.canceled";
  if (!isSubscriptionEvent) return null;

  const paddleSubscriptionId = asString(data.id);
  // The subscription's own status is the authority on whether it is paid. A
  // cancellation scheduled for the end of the period leaves it "active", so
  // this keeps Pro until the period actually ends rather than cutting it off
  // the moment someone clicks cancel.
  const status = asString(data.status) ?? "unknown";

  const fields: SubscriptionFields = {
    plan: PRO_STATUSES.has(status) ? "pro" : "free",
    status,
  };
  if (paddleSubscriptionId) {
    fields.paddle_subscription_id = paddleSubscriptionId;
  }
  if (paddleCustomerId) fields.paddle_customer_id = paddleCustomerId;

  const priceId = firstPriceId(data);
  if (priceId) fields.price_id = priceId;

  const periodEnd = asString(asRecord(data.current_billing_period).ends_at);
  if (periodEnd) fields.current_period_end = periodEnd;

  const canceledAt = asString(data.canceled_at);
  if (canceledAt) fields.canceled_at = canceledAt;

  return { userId, paddleSubscriptionId, paddleCustomerId, fields };
}
