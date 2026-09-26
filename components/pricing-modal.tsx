"use client";

import { useEffect, useRef, useState } from "react";

import { Notice } from "@/components/primitives";
import { usePaddle } from "@/components/paddle-provider";
import {
  PADDLE_PRO_PRICE_ID,
  PADDLE_SETUP_HINT,
  PRO_PLAN,
  isPaddleConfigured,
} from "@/lib/paddle/env";
import type { Plan } from "@/lib/subscriptions";

/**
 * The Pro plan, and the button that opens Paddle's checkout.
 *
 * Split in two so the hooks are unconditional: `PricingModal` decides whether
 * anything renders, and `PricingDialog` is mounted only while it does, which
 * lets it attach its keyboard listener and move focus without every hook
 * carrying an `if (open)` guard.
 */

/**
 * Paddle's overlay is a frame it renders itself, so it cannot inherit the
 * page's CSS variables and has to be told which theme to use. Read at the
 * moment of the click rather than at render: the customer may have switched
 * their system theme while the page was open, and `matchMedia` is cheap.
 */
function preferredTheme(): "light" | "dark" {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function messageFor(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function PricingModal({
  open,
  onClose,
  plan,
  email,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  /** The plan the account is on, as far as the subscriptions row knows. */
  plan: Plan;
  /** Prefilled into the checkout. */
  email: string | null;
  /** The Supabase account id, sent as checkout custom data. */
  userId: string | null;
}) {
  if (!open) return null;

  return (
    <PricingDialog
      onClose={onClose}
      plan={plan}
      email={email}
      userId={userId}
    />
  );
}

function PricingDialog({
  onClose,
  plan,
  email,
  userId,
}: {
  onClose: () => void;
  plan: Plan;
  email: string | null;
  userId: string | null;
}) {
  const { paddle } = usePaddle();
  const dialog = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const isPro = plan === "pro";

  useEffect(() => {
    // Escape closes, because a modal that traps a keyboard user is worse than
    // one that closes when they change their mind.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    // Focus moves into the dialog so the next Tab stays inside it, and so a
    // screen reader announces the heading rather than the page behind.
    dialog.current?.focus();

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function upgrade(): void {
    // Not reachable through the UI — the button is disabled in both cases —
    // but opening a checkout without an instance would throw into the void,
    // and without a user id the webhook could not attribute the payment.
    if (!paddle || !userId) return;

    setError(null);
    try {
      paddle.Checkout.open({
        items: [{ priceId: PADDLE_PRO_PRICE_ID, quantity: 1 }],
        // The only thread between the payment and the account. Paddle copies
        // custom data onto the subscription it creates, and the webhook reads
        // it back to decide which row to write.
        customData: { user_id: userId },
        ...(email ? { customer: { email } } : {}),
        settings: { displayMode: "overlay", theme: preferredTheme() },
      });
    } catch (caught) {
      setError(messageFor(caught, "The checkout could not be opened."));
    }
  }

  /*
   * Why the button says what it says while it is disabled, or null when it can
   * be pressed. Both cases are transient and both resolve on their own: the
   * account id arrives with the page's first fetch, and the instance with
   * Paddle's script.
   */
  const pending = !userId
    ? "Finding your account…"
    : !paddle
      ? "Loading the secure checkout…"
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
      // mousedown rather than click: a drag that starts inside the dialog and
      // ends on the backdrop should not close it, and comparing the target to
      // the container is what tells the two apart.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pricing-title"
        tabIndex={-1}
        className="card relative w-full max-w-md p-6 outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 rounded-md px-2 py-1 text-lg leading-none text-muted transition-colors hover:text-accent"
        >
          ×
        </button>

        <h2
          id="pricing-title"
          className="font-serif text-xl font-semibold tracking-tight"
        >
          {PRO_PLAN.name} plan
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {PRO_PLAN.summary}
        </p>

        <div className="mt-4 flex items-baseline gap-2">
          <span className="font-serif text-4xl leading-none font-semibold">
            {PRO_PLAN.price}
          </span>
          <span className="text-sm text-muted">{PRO_PLAN.cadence}</span>
        </div>

        <ul className="mt-4 space-y-2">
          {PRO_PLAN.features.map((feature) => (
            <li key={feature} className="flex gap-2.5 text-sm leading-relaxed">
              <span aria-hidden className="mt-0.5 shrink-0 text-accent">
                ✓
              </span>
              <span className="text-muted">{feature}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5">
          {isPro ? (
            <Notice tone="ok">
              You are on the {PRO_PLAN.name} plan.
              {email ? ` Billed to ${email}.` : ""}
            </Notice>
          ) : !isPaddleConfigured ? (
            /*
             * No button at all rather than a disabled one. There is nothing the
             * customer could do about a missing token, and a dead control with
             * a paragraph pasted into it reads as a broken page rather than an
             * unconfigured one.
             */
            <Notice tone="warn">{PADDLE_SETUP_HINT}</Notice>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary w-full"
                disabled={pending !== null}
                onClick={upgrade}
              >
                {pending ?? `Upgrade to ${PRO_PLAN.name}`}
              </button>
              {/*
               * The account the plan lands on is worth naming: the purchase is
               * tied to whoever is signed in, not to the address typed into
               * the checkout, and the two are easy to confuse.
               */}
              <p className="mt-2 text-center text-xs text-faint">
                {email
                  ? `The plan is added to ${email}.`
                  : "The plan is added to the account you are signed in to."}
              </p>
            </>
          )}

          {error ? (
            <div className="mt-3">
              <Notice tone="error">{error}</Notice>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
