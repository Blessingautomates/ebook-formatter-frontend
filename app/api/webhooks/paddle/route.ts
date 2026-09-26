import { NextResponse, type NextRequest } from "next/server";

import {
  PADDLE_WEBHOOK_SECRET,
  provisionSubscription,
} from "@/lib/paddle/server";
import { verifyPaddleSignature, type PaddleEvent } from "@/lib/paddle/webhook";

/**
 * Paddle's notification endpoint: the only thing that grants a plan.
 *
 * A checkout completing in the browser proves nothing — the customer controls
 * that page. This is where a payment becomes a subscription row, and it is
 * trusted only because the request carries a signature made with a secret that
 * never leaves the server.
 *
 * Two things about the placement are worth knowing:
 *
 * - It lives under `/api`, which next.config.mjs rewrites to the FastAPI
 *   backend. That rewrite is an *afterFiles* one, so it is consulted only once
 *   no route matches — and this route matches. The backend never sees it.
 * - middleware.ts excludes `/api` from the session refresh, which is right
 *   here: Paddle sends no cookie, and there is no session to refresh.
 *
 * `node:crypto` is what verifies the signature, so this must not be moved to
 * the edge runtime. The default is already Node; it is stated to keep it that
 * way.
 */
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  /*
   * The raw text of the body, read once. The signature covers the exact bytes
   * Paddle sent, so taking `request.json()` first and hashing a re-serialised
   * copy would reorder keys and drop whitespace, and every notification would
   * fail to verify.
   */
  const rawBody = await request.text();

  if (!PADDLE_WEBHOOK_SECRET) {
    /*
     * 500 rather than 401. Nothing about this request is wrong — the deployment
     * is — and Paddle retries a 5xx, so the notification is still there to be
     * delivered once someone sets the variable.
     */
    console.error(
      "[paddle] PADDLE_WEBHOOK_SECRET is not set — refusing the notification",
    );
    return NextResponse.json(
      { error: "webhook_not_configured" },
      { status: 500 },
    );
  }

  const verified = verifyPaddleSignature(
    rawBody,
    request.headers.get("paddle-signature"),
    PADDLE_WEBHOOK_SECRET,
  );

  if (!verified) {
    // No detail about which check failed: an unsigned request is either a
    // misconfiguration or someone probing, and saying more helps only the
    // second. This is the log line to look for when a real delivery is being
    // rejected.
    console.error("[paddle] rejected a notification with an invalid signature");
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let event: PaddleEvent;
  try {
    event = JSON.parse(rawBody) as PaddleEvent;
  } catch {
    // Signed but unparseable, which would be a bug on Paddle's side. Retrying
    // cannot fix it, so this is a 400.
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const outcome = await provisionSubscription(event);

    console.log(
      `[paddle] ${event.event_type ?? "unknown event"} (${
        event.event_id ?? "no id"
      }): ${outcome.action} — ${outcome.reason}`,
    );

    /*
     * 200 for an ignored notification as much as for a write. Paddle retries
     * anything that is not a 2xx, and an event this app does not model will
     * never become one — retrying it for a day would only delay the deliveries
     * that do matter.
     */
    return NextResponse.json({ ok: true, action: outcome.action });
  } catch (error) {
    // 500 so Paddle retries. Every write the handler performs states the fields
    // it knows in full, so a redelivery lands the row in the same place as the
    // first attempt rather than double-applying anything.
    console.error("[paddle] provisioning failed", error);
    return NextResponse.json({ error: "provision_failed" }, { status: 500 });
  }
}
