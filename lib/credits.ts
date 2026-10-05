import type { Plan } from "./paddle/webhook";
import { createClient } from "./supabase/client";

/**
 * Data access for the account's AI credits.
 *
 * Credits are a ledger, not a counter: every grant and every spend is a row in
 * `credit_ledger`, and the balance is their sum. A counter would need a
 * read-modify-write on every spend, which two concurrent analyses would race;
 * appending rows cannot.
 *
 * Nothing here writes. Rows are written by `ensure_credit_grant()` — a
 * `security definer` function that issues the monthly allowance — and by the
 * backend when an analysis is paid for. The client can call the first but
 * cannot forge it, and `credit_ledger` grants `select` and no insert, for the
 * same reason `subscriptions` does: an account that could write its own balance
 * would have no reason to buy credits.
 *
 * The sums are computed in the database rather than by fetching rows and adding
 * them up here. A ledger only grows, so a client-side sum would need every row
 * the account ever had — correct on day one and silently wrong once the read
 * hits its limit.
 */

/** The monthly allowance each plan carries, in credits. */
export const FREE_MONTHLY_CREDITS = 25_000;
export const PRO_MONTHLY_CREDITS = 100_000;

export function creditAllowanceFor(plan: Plan): number {
  return plan === "pro" ? PRO_MONTHLY_CREDITS : FREE_MONTHLY_CREDITS;
}

export interface CreditSummary {
  plan: Plan;
  /** What the plan grants each month. */
  allowance: number;
  /** Grants minus spends, over the account's whole history. */
  balance: number;
  /** Credits spent in the current period, as a positive number. */
  spent: number;
  /** Start of the current allowance period. */
  periodStart: string | null;
}

/** The single row `credit_summary()` returns. */
interface CreditSummaryRow {
  balance: number | string | null;
  spent: number | string | null;
  period_start: string | null;
}

export interface CreditEntry {
  id: string;
  delta: number;
  reason: string;
  ref: string | null;
  created_at: string;
}

/** Human labels for the ledger's `reason` values. */
const CREDIT_REASONS: Record<string, string> = {
  monthly_grant: "Monthly allowance",
  analysis: "Manuscript analysis",
  package: "Publishing package",
  cover: "Cover validation",
  purchase: "Credit purchase",
  adjustment: "Adjustment",
};

export function creditReasonLabel(reason: string): string {
  return CREDIT_REASONS[reason] ?? reason.replace(/[_-]+/g, " ");
}

/**
 * The ledger's most recent entries, newest first.
 *
 * Read directly rather than through a function: the select-own policy on
 * `credit_ledger` already scopes it, and the arithmetic that has to be
 * trustworthy — the balance — is the one done in `credit_summary()`.
 */
export async function listMyCreditLedger(limit = 50): Promise<CreditEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("credit_ledger")
    .select("id,delta,reason,ref,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Could not read your credit history: ${error.message}`);
  }
  return (data ?? []) as unknown as CreditEntry[];
}

/**
 * The signed-in account's credit position.
 *
 * Calls `ensure_credit_grant()` first, so a month that has not been granted yet
 * is topped up before the balance is read — otherwise an account would appear
 * to have run out on the first of the month. The function is idempotent, so
 * calling it on every read costs one no-op write at most.
 *
 * Throws rather than returning a zeroed summary. A failed read and a genuine
 * zero balance must not look the same: the first is a setup problem the user
 * can act on, and showing it as "0 credits" would read as "you are out".
 */
export async function getMyCredits(plan: Plan): Promise<CreditSummary> {
  const supabase = createClient();

  const { error: grantError } = await supabase.rpc("ensure_credit_grant");
  if (grantError) {
    throw new Error(`Could not read your credits: ${grantError.message}`);
  }

  const { data, error } = await supabase
    .rpc("credit_summary")
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read your credits: ${error.message}`);
  }

  const row = (data ?? null) as CreditSummaryRow | null;

  return {
    plan,
    allowance: creditAllowanceFor(plan),
    // Postgres `bigint` arrives as a string through PostgREST, because JSON
    // numbers cannot hold every value it can. `Number` is safe here: a credit
    // balance is nowhere near 2^53.
    balance: Number(row?.balance ?? 0),
    spent: Number(row?.spent ?? 0),
    periodStart: row?.period_start ?? null,
  };
}
