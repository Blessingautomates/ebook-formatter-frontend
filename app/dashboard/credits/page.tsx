"use client";

import { useEffect, useState } from "react";

import { Notice, Spinner, Stat } from "@/components/primitives";
import { useAccount } from "@/components/shell/account-context";
import {
  creditReasonLabel,
  listMyCreditLedger,
  type CreditEntry,
} from "@/lib/credits";
import { isSupabaseConfigured, SUPABASE_SETUP_HINT } from "@/lib/supabase/env";

const NUMBER = new Intl.NumberFormat("en-US");

const DATE = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * AI Credits.
 *
 * Reads the same summary the header pill shows, plus the ledger behind it. The
 * history is the part that answers "where did they go" — a balance alone
 * cannot, and an author who has just spent 140 credits on a 130,000-word
 * manuscript should be able to see that is what happened.
 */
export default function CreditsPage() {
  const { credits, creditsError, plan, onUpgrade } = useAccount();

  const [entries, setEntries] = useState<CreditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError(SUPABASE_SETUP_HINT);
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const rows = await listMyCreditLedger(50);
        if (!cancelled) setEntries(rows);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error && caught.message
              ? caught.message
              : "Your credit history could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const remainingPercent =
    credits && credits.allowance > 0
      ? Math.max(0, Math.round((credits.balance / credits.allowance) * 100))
      : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">AI Credits</h1>
          <p className="mt-1 text-sm text-muted">
            Credits are spent on analysis. The balance is the sum of every grant
            and every spend on this account.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onUpgrade}>
          {plan === "pro" ? "Manage plan" : "Buy credits"}
        </button>
      </header>

      {creditsError ? <Notice tone="error">{creditsError}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      {credits ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Balance" value={NUMBER.format(credits.balance)} />
          <Stat
            label="Monthly allowance"
            value={NUMBER.format(credits.allowance)}
            sub={plan === "pro" ? "Pro plan" : "Free plan"}
          />
          <Stat
            label="Spent this period"
            value={NUMBER.format(credits.spent)}
            sub={credits.periodStart ? `Since ${credits.periodStart}` : undefined}
          />
        </div>
      ) : !creditsError ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner /> Reading your balance…
        </p>
      ) : null}

      {credits ? (
        <div className="card p-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">{remainingPercent}% of the allowance left</span>
            <span className="text-muted">
              {NUMBER.format(credits.balance)} of {NUMBER.format(credits.allowance)}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={remainingPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Credits remaining"
            className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"
          >
            <div
              className={`h-full rounded-full ${
                remainingPercent <= 10
                  ? "bg-danger"
                  : remainingPercent <= 30
                    ? "bg-warn"
                    : "bg-accent"
              }`}
              style={{ width: `${remainingPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-serif text-lg font-semibold">History</h2>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> Loading history…
          </p>
        ) : entries.length === 0 ? (
          <div className="card px-6 py-10 text-center text-sm text-muted">
            No credit activity yet. Analyzing a manuscript is what spends them.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">What</th>
                  <th className="px-4 py-2 text-left font-medium">When</th>
                  <th className="px-4 py-2 text-right font-medium">Credits</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-line">
                    <td className="px-4 py-2.5">
                      {creditReasonLabel(entry.reason)}
                      {entry.ref ? (
                        <span className="ml-2 text-xs text-muted">{entry.ref}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {DATE.format(new Date(entry.created_at))}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right tabular-nums ${
                        entry.delta < 0 ? "text-danger" : "text-ok"
                      }`}
                    >
                      {entry.delta > 0 ? "+" : ""}
                      {NUMBER.format(entry.delta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
