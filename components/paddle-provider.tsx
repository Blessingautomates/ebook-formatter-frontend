"use client";

import {
  CheckoutEventNames,
  initializePaddle,
  type Paddle,
  type PaddleEventData,
} from "@paddle/paddle-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  PADDLE_CLIENT_TOKEN,
  PADDLE_ENVIRONMENT,
  isPaddleConfigured,
} from "@/lib/paddle/env";

/**
 * Paddle.js, loaded once and shared through context.
 *
 * The checkout is a script Paddle serves from their own CDN, and it has to be
 * fetched and initialised in the browser before a price can be shown — which
 * takes long enough that doing it on the click would leave the button
 * unresponsive with nothing to show for it. Mounting it with the app instead
 * means the overlay opens the instant someone asks for it.
 *
 * This wraps the whole app (app/layout.tsx) rather than only the dashboard,
 * because the provider has to sit above whatever opens the checkout. The cost
 * is that the script is fetched on every route, including pages that cannot
 * sell anything; if that matters more than the click latency, the fix is to
 * load it from the button that opens the modal instead.
 *
 * `@paddle/paddle-js` is safe to import during a server render — it touches no
 * browser global until `initializePaddle` is called — so being a client
 * component here is about the effect and the context, not about the import.
 */

export interface PaddleCheckoutState {
  /** The initialised instance, or null until it has loaded or if it failed. */
  paddle: Paddle | null;
  /**
   * The last checkout event worth reacting to, so a page can re-read the plan
   * once a purchase has gone through.
   */
  lastEvent: PaddleEventData | null;
}

const IDLE: PaddleCheckoutState = { paddle: null, lastEvent: null };

const PaddleContext = createContext<PaddleCheckoutState>(IDLE);

export function usePaddle(): PaddleCheckoutState {
  return useContext(PaddleContext);
}

/**
 * The checkout events that change what the page should show.
 *
 * Filtered at the source rather than in each consumer: Paddle reports every
 * step of the overlay, and a customer typing a postcode would otherwise
 * re-render every component under this provider several times a second.
 *
 * `closed` is here as well as `completed` because the webhook that writes the
 * plan is a separate delivery from the one the browser sees — the row can lag
 * the checkout by a second or two, and the second look when the overlay closes
 * is what usually catches it.
 */
const REPORTED_EVENTS = new Set<string>([
  CheckoutEventNames.CHECKOUT_COMPLETED,
  CheckoutEventNames.CHECKOUT_CLOSED,
  CheckoutEventNames.CHECKOUT_ERROR,
]);

export function PaddleProvider({ children }: { children: ReactNode }) {
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [lastEvent, setLastEvent] = useState<PaddleEventData | null>(null);

  useEffect(() => {
    // Without a token there is nothing to initialise, and calling through
    // would inject Paddle's script only to have it reject.
    if (!isPaddleConfigured) return;

    let cancelled = false;

    void initializePaddle({
      environment: PADDLE_ENVIRONMENT,
      token: PADDLE_CLIENT_TOKEN,
      eventCallback: (event) => {
        if (event?.name && REPORTED_EVENTS.has(event.name)) setLastEvent(event);
      },
    })
      .then((instance) => {
        if (!cancelled) setPaddle(instance ?? null);
      })
      .catch(() => {
        // Left null on purpose. The upgrade button stays disabled and says why,
        // which is more use than a checkout that opens onto a blank frame.
      });

    /*
     * Only guards the state update. Development runs this effect twice under
     * StrictMode, and that is safe: the library caches the CDN load and turns a
     * second `initializePaddle` into an update of the instance it already has.
     */
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ paddle, lastEvent }), [paddle, lastEvent]);

  return (
    <PaddleContext.Provider value={value}>{children}</PaddleContext.Provider>
  );
}
