/**
 * Tests for lib/paddle/webhook.ts — signature verification and the translation
 * from a Paddle notification to the fields the subscriptions row carries.
 *
 * No test runner and no new dependency: Node strips the TypeScript itself from
 * v22.6 on, so this imports the real module and runs it directly.
 *
 *   npm test
 *
 * One limitation worth stating. The valid-signature cases below sign with the
 * same construction the implementation verifies — an HMAC over `"{ts}:{body}"`
 * — so a mistake in *that* composition would be made on both sides and would
 * pass here. What these cases do prove is everything around it: that the header
 * is parsed rather than assumed, that a body edited in flight fails, that a
 * replayed timestamp fails, that a rotation's second digest is accepted, and
 * that every branch of the event mapping writes what it should. The composition
 * itself is Paddle's documented scheme and is on the manual sandbox pass in the
 * README, which is the only place a real signature can come from.
 */

import { createHmac } from "node:crypto";

import {
  SIGNATURE_TOLERANCE_SECONDS,
  parsePaddleSignature,
  subscriptionUpdateFor,
  verifyPaddleSignature,
} from "../lib/paddle/webhook.ts";

let fails = 0;

/**
 * Key order is not what is under test, so both sides are sorted before they are
 * compared — otherwise a check would fail for having written `{ plan, status }`
 * where the implementation built `{ status, plan }`.
 */
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

function check(label, actual, expected) {
  const a = JSON.stringify(stable(actual));
  const e = JSON.stringify(stable(expected));
  const ok = a === e;
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: ${a}${ok ? "" : `  WANT ${e}`}`);
}

const SECRET = "pdl_ntfset_test_secret";
/** A fixed instant, so the freshness checks do not depend on the clock. */
const NOW_MS = 1_700_000_000_000;
const NOW_S = NOW_MS / 1000;

const USER_ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const PRO_PRICE = "pri_01hpro";
const OTHER_PRICE = "pri_01hother";

function sign(body, { ts = NOW_S, secret = SECRET } = {}) {
  const h1 = createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex");
  return `ts=${ts};h1=${h1}`;
}

function verifies(body, header, secret = SECRET, nowMs = NOW_MS) {
  return verifyPaddleSignature(body, header, secret, nowMs);
}

const BODY = JSON.stringify({ event_type: "transaction.completed" });

check("a correct signature verifies", verifies(BODY, sign(BODY)), true);
check("a tampered body fails", verifies(`${BODY} `, sign(BODY)), false);
check("a wrong secret fails", verifies(BODY, sign(BODY), "pdl_ntfset_other"), false);
check("an empty secret fails", verifies(BODY, sign(BODY), ""), false);
check("no header fails", verifies(BODY, null), false);
check("an empty header fails", verifies(BODY, ""), false);
check("a header without a digest fails", verifies(BODY, `ts=${NOW_S}`), false);
check("a header without a timestamp fails", verifies(BODY, "h1=abc"), false);
check("a non-numeric timestamp fails", verifies(BODY, "ts=soon;h1=abc"), false);
check("a truncated digest fails", verifies(BODY, `ts=${NOW_S};h1=abc`), false);
check("a digest of the wrong length fails", verifies(BODY, `ts=${NOW_S};h1=${"a".repeat(63)}`), false);

// Hex is case-insensitive on the way in, and a digest typed out by hand or
// pasted through something that upper-cases it should still verify.
const [tsPart, h1Part] = sign(BODY).split(";");
check(
  "an uppercase digest verifies",
  verifies(BODY, `${tsPart};h1=${h1Part.slice(3).toUpperCase()}`),
  true,
);

/*
 * The timestamp is what makes a captured notification stop being replayable.
 * The bound is two-sided: a clock running fast is as much a reason to refuse
 * the claim as one running slow.
 */
check(
  "a signature from inside the window verifies",
  verifies(BODY, sign(BODY, { ts: NOW_S - SIGNATURE_TOLERANCE_SECONDS + 1 })),
  true,
);
check(
  "a replayed signature fails",
  verifies(BODY, sign(BODY, { ts: NOW_S - SIGNATURE_TOLERANCE_SECONDS - 1 })),
  false,
);
check(
  "a timestamp from the future fails",
  verifies(BODY, sign(BODY, { ts: NOW_S + SIGNATURE_TOLERANCE_SECONDS + 1 })),
  false,
);

/*
 * Rotating a signing secret produces a header carrying both the old and the new
 * digest for the overlap. Refusing it would drop every delivery for the length
 * of the rotation, so any match is enough.
 */
const rotated = `ts=${NOW_S};h1=${"0".repeat(64)};${sign(BODY).split(";")[1]}`;
check("a rotation's second digest is accepted", verifies(BODY, rotated), true);
check("a header with no matching digest fails", verifies(BODY, `ts=${NOW_S};h1=${"0".repeat(64)}`), false);

check("an unknown field is ignored", parsePaddleSignature(`ts=${NOW_S};h1=abc;v=2`), {
  ts: NOW_S,
  h1: ["abc"],
});
check("a malformed header parses to null", parsePaddleSignature("nonsense"), null);

// ---- event mapping ----

const transaction = (data) => ({
  event_id: "evt_1",
  event_type: "transaction.completed",
  data,
});

const subscription = (eventType, data) => ({
  event_id: "evt_2",
  event_type: eventType,
  data,
});

/** The parts of the result under test, so a check reads as one line. */
function fields(update) {
  return update ? update.fields : null;
}

const paid = transaction({
  id: "txn_01",
  status: "completed",
  customer_id: "ctm_01",
  subscription_id: "sub_01",
  custom_data: { user_id: USER_ID },
  items: [{ price: { id: PRO_PRICE }, quantity: 1 }],
});

const paidUpdate = subscriptionUpdateFor(paid, { proPriceId: PRO_PRICE });
check("a completed subscription payment grants Pro", fields(paidUpdate), {
  plan: "pro",
  status: "active",
  paddle_subscription_id: "sub_01",
  paddle_customer_id: "ctm_01",
  price_id: PRO_PRICE,
});
check("the payer is named", paidUpdate?.userId, USER_ID);

/*
 * A transaction carries no billing period, and that is the reason the writer
 * updates only the fields an event knows: setting this one to null would blank
 * the renewal date an earlier subscription event stored.
 */
check(
  "a completed payment does not touch the billing period",
  Object.hasOwn(fields(paidUpdate), "current_period_end"),
  false,
);

check(
  "a completed one-off payment for something else is ignored",
  subscriptionUpdateFor(
    transaction({
      id: "txn_02",
      subscription_id: null,
      custom_data: { user_id: USER_ID },
      items: [{ price: { id: OTHER_PRICE } }],
    }),
    { proPriceId: PRO_PRICE },
  ),
  null,
);

/*
 * The fallback for a checkout configured as a one-off by mistake: someone has
 * paid for Pro either way, and a webhook that shrugged because the transaction
 * named no subscription would leave them with nothing.
 */
check(
  "a completed one-off payment for the Pro price grants Pro",
  fields(
    subscriptionUpdateFor(
      transaction({
        id: "txn_03",
        customer_id: "ctm_01",
        subscription_id: null,
        custom_data: { user_id: USER_ID },
        items: [{ price: { id: PRO_PRICE } }],
      }),
      { proPriceId: PRO_PRICE },
    ),
  ),
  { plan: "pro", status: "active", paddle_customer_id: "ctm_01", price_id: PRO_PRICE },
);

const created = subscriptionUpdateFor(
  subscription("subscription.created", {
    id: "sub_01",
    status: "active",
    customer_id: "ctm_01",
    custom_data: { user_id: USER_ID },
    items: [{ price: { id: PRO_PRICE } }],
    current_billing_period: { starts_at: "2026-01-01T00:00:00Z", ends_at: "2026-02-01T00:00:00Z" },
  }),
  { proPriceId: PRO_PRICE },
);
check("a created subscription grants Pro and stores the period", fields(created), {
  plan: "pro",
  status: "active",
  paddle_subscription_id: "sub_01",
  paddle_customer_id: "ctm_01",
  price_id: PRO_PRICE,
  current_period_end: "2026-02-01T00:00:00Z",
});

/*
 * Paddle retries a failed renewal for a couple of weeks without ending the
 * subscription, so `past_due` keeps access while it does. See PRO_STATUSES.
 */
check(
  "past_due keeps Pro while the renewal is retried",
  fields(subscriptionUpdateFor(subscription("subscription.updated", { id: "sub_01", status: "past_due" })))?.plan,
  "pro",
);

check(
  "a cancelled subscription drops to free",
  fields(
    subscriptionUpdateFor(
      subscription("subscription.canceled", {
        id: "sub_01",
        status: "canceled",
        canceled_at: "2026-02-01T00:00:00Z",
      }),
    ),
  ),
  { plan: "free", status: "canceled", paddle_subscription_id: "sub_01", canceled_at: "2026-02-01T00:00:00Z" },
);

/*
 * Cancelling mid-period leaves the subscription `active` with a scheduled
 * change; only the status decides, so access survives until the period ends.
 */
check(
  "a cancellation scheduled for later keeps Pro",
  fields(
    subscriptionUpdateFor(
      subscription("subscription.updated", { id: "sub_01", status: "active" }),
    ),
  )?.plan,
  "pro",
);

check(
  "an event for a paused subscription drops to free",
  fields(subscriptionUpdateFor(subscription("subscription.updated", { id: "sub_01", status: "paused" })))?.plan,
  "free",
);

check(
  "an event type this app does not model is ignored",
  subscriptionUpdateFor({ event_type: "payout.created", data: { id: "pay_01" } }),
  null,
);
check("an event with no data is ignored", subscriptionUpdateFor({ event_type: "subscription.updated" }), null);
check("a missing event is ignored", subscriptionUpdateFor(null), null);

/*
 * The user id goes into a uuid column of a table keyed by auth.users. A value
 * that is not one is dropped here rather than sent to Postgres, where it would
 * come back as a type error saying nothing about where it came from — and the
 * fallback lookup then gets its chance.
 */
check(
  "a custom data user id that is not a uuid is not used",
  subscriptionUpdateFor(
    subscription("subscription.updated", {
      id: "sub_01",
      status: "active",
      custom_data: { user_id: "not-a-uuid" },
    }),
  )?.userId,
  null,
);
check(
  "a missing custom data user id is null",
  subscriptionUpdateFor(subscription("subscription.updated", { id: "sub_01", status: "active" }))?.userId,
  null,
);
check(
  "an odd custom data payload does not throw",
  subscriptionUpdateFor(
    subscription("subscription.updated", { id: "sub_01", status: "active", custom_data: "a string" }),
  )?.userId,
  null,
);
check(
  "an event with no line items still maps",
  fields(subscriptionUpdateFor(subscription("subscription.updated", { id: "sub_01", status: "active" }))),
  { plan: "pro", status: "active", paddle_subscription_id: "sub_01" },
);

console.log(`\n${fails} failure(s)`);
process.exit(fails === 0 ? 0 : 1);
