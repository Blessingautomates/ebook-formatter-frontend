"use client";

import { createContext, useContext } from "react";

import type { CreditSummary } from "@/lib/credits";
import type { Plan } from "@/lib/subscriptions";

/**
 * The account facts the dashboard's chrome and its right rail both show.
 *
 * The shell loads these once — who is signed in, which plan, how many credits
 * are left — and several widgets read them: the header's credits pill, the
 * sidebar's upgrade card, and the dashboard's credits panel. Loading them in
 * each would mean three requests for one number, and three chances to disagree
 * about it.
 *
 * Separate from the workspace context because the two change independently: an
 * agency workspace switched in the header must not re-read the credit balance,
 * and a credit spend must not disturb which workspace is open.
 */
export interface AccountContextValue {
  email: string | null;
  /** Null until the subscription has been read, or when there is none. */
  plan: Plan | null;
  credits: CreditSummary | null;
  creditsError: string | null;
  /** Open the pricing modal — the shell owns it, so every CTA routes through here. */
  onUpgrade: () => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export const AccountProvider = AccountContext.Provider;

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) {
    throw new Error(
      "useAccount was called outside the dashboard shell. Wrap the tree in AppShell.",
    );
  }
  return value;
}
