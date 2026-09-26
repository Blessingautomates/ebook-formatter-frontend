/**
 * Paddle configuration for the browser, read in one place so the checkout and
 * the setup hint agree on whether the integration has been wired up.
 *
 * Everything here is `NEXT_PUBLIC_`, so it ships to the browser — which is
 * intended, and is how Paddle's own client-side checkout works. The client
 * token only identifies the seller account; Paddle decides which origins are
 * allowed to open a checkout with it, so publishing it does not let anyone
 * take a payment on our behalf.
 *
 * The webhook signing secret is the one credential that must *not* be public:
 * whoever holds it can forge a notification and hand themselves Pro. It lives
 * in lib/paddle/server.ts, which nothing client-side imports.
 *
 * Read as literals rather than through `process.env[name]` for the same reason
 * as lib/supabase/env.ts: Next inlines the literal expression at build time, so
 * a computed lookup would come back `undefined` in the browser.
 */

export const PADDLE_CLIENT_TOKEN = (
  process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? ""
).trim();

/**
 * Which Paddle environment the checkout talks to. Anything other than an
 * explicit "production" is treated as sandbox, so a typo in the variable
 * cannot quietly start charging real cards.
 */
export const PADDLE_ENVIRONMENT: "sandbox" | "production" =
  (process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT ?? "").trim().toLowerCase() ===
  "production"
    ? "production"
    : "sandbox";

/** The Pro plan's price (`pri_…`), from Paddle → Catalog → Products. */
export const PADDLE_PRO_PRICE_ID = (
  process.env.NEXT_PUBLIC_PADDLE_PRO_PRICE_ID ?? ""
).trim();

export const isPaddleConfigured = Boolean(
  PADDLE_CLIENT_TOKEN && PADDLE_PRO_PRICE_ID,
);

export const PADDLE_SETUP_HINT =
  "Paddle is not configured. Copy .env.example to .env.local and set " +
  "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN and NEXT_PUBLIC_PADDLE_PRO_PRICE_ID from " +
  "your Paddle account.";

/**
 * The Pro plan as the pricing modal describes it.
 *
 * Display copy only. Paddle holds the real price — the amount, the currency
 * and the billing interval all come from the price ID at checkout — so this is
 * a label that has to be kept in step with the catalog by hand, not a value
 * anything computes with.
 *
 * The list is what the formatter already does, not a set of limits: nothing in
 * the app is gated on the plan yet. See the note in the README before treating
 * this as a promise.
 */
export const PRO_PLAN = {
  name: "Pro",
  price: "$12",
  cadence: "per month",
  summary: "Everything the formatter does, for one flat monthly price.",
  features: [
    "Every export format — PDF, EPUB, DOCX, RTF and TXT.",
    "Chapter-by-chapter editing with live typography.",
    "Saved manuscripts, kept between visits.",
    "Print-ready output at 6×9, 5.5×8.5 and A5 trim.",
  ],
} as const;
