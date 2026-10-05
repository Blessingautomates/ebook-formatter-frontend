"use client";

import Link from "next/link";

import { Spinner } from "@/components/primitives";
import { useAccount } from "@/components/shell/account-context";
import {
  CreditsIcon,
  HelpIcon,
  PlayIcon,
  SettingsIcon,
  SparkleIcon,
  TemplateIcon,
  TranslateIcon,
  UploadIcon,
  UsersIcon,
} from "@/components/shell/icons";
import { creditAllowanceFor } from "@/lib/credits";

const NUMBER = new Intl.NumberFormat("en-US");

/**
 * The AI credits panel.
 *
 * Three states, and it distinguishes all three: loading, a real balance, and a
 * read that failed. It does not fall back to zero on failure — see
 * `lib/credits.ts` for why showing "0 credits" for a setup problem would read
 * as "you are out".
 */
export function CreditsCard() {
  const { credits, creditsError, plan, onUpgrade } = useAccount();

  // The allowance is known from the plan even before the ledger read lands, so
  // the card can show its shape while the number is still coming.
  const allowance = credits?.allowance ?? (plan ? creditAllowanceFor(plan) : null);
  const usedPercent =
    credits && credits.allowance > 0
      ? Math.min(100, Math.round((credits.spent / credits.allowance) * 100))
      : 0;

  return (
    <section className="card p-4">
      <header className="flex items-center gap-2">
        <CreditsIcon className="size-4 text-accent" />
        <h2 className="text-sm font-semibold">AI Credits</h2>
      </header>

      {creditsError ? (
        <p className="mt-2 text-xs leading-relaxed text-danger">{creditsError}</p>
      ) : !credits ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted">
          <Spinner /> Reading your balance…
        </p>
      ) : (
        <>
          <p className="mt-2 font-serif text-xl font-semibold">
            {NUMBER.format(credits.balance)}
            <span className="text-sm font-normal text-muted">
              {allowance ? ` / ${NUMBER.format(allowance)}` : ""}
            </span>
          </p>
          <div
            role="progressbar"
            aria-valuenow={usedPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Credits used this period"
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
          >
            <div
              className={`h-full rounded-full ${
                usedPercent >= 90
                  ? "bg-danger"
                  : usedPercent >= 70
                    ? "bg-warn"
                    : "bg-accent"
              }`}
              style={{ width: `${usedPercent}%` }}
            />
          </div>
          <p className="mt-1.5 text-[0.7rem] text-muted">
            {NUMBER.format(credits.spent)} spent this period · analysis costs 10
            credits plus 1 per 1,000 words
          </p>
        </>
      )}

      <button type="button" className="btn btn-sm mt-3 w-full" onClick={onUpgrade}>
        Buy credits
      </button>
    </section>
  );
}

const QUICK_ACTIONS = [
  {
    href: "/dashboard/books/new",
    label: "Upload Manuscript",
    hint: "Measure, check and format",
    Icon: UploadIcon,
  },
  {
    href: "/dashboard/templates",
    label: "Browse Templates",
    hint: "Nine genre sheets",
    Icon: TemplateIcon,
  },
  {
    href: "/dashboard/presets",
    label: "Publishing Presets",
    hint: "Trim, type and metadata",
    Icon: SettingsIcon,
  },
  {
    href: "/dashboard/translation",
    label: "Translation",
    hint: "Status of the service",
    Icon: TranslateIcon,
  },
];

export function QuickActions() {
  return (
    <section className="card p-4">
      <h2 className="text-sm font-semibold">Quick actions</h2>
      <ul className="mt-2 space-y-0.5">
        {QUICK_ACTIONS.map(({ href, label, hint, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2"
            >
              <Icon className="size-4 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{label}</span>
                <span className="block truncate text-[0.7rem] text-muted">
                  {hint}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The upgrade prompt, which has to be honest about already being upgraded.
 *
 * It reads the real plan rather than assuming free: a Pro account shown "Go
 * Pro" would be a lie the user can see through immediately.
 */
export function UpgradeWidget() {
  const { plan, onUpgrade } = useAccount();
  const isPro = plan === "pro";

  return (
    <section className="card overflow-hidden">
      <div className="bg-gradient-to-br from-accent-soft to-surface-2 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <SparkleIcon className="size-4 text-accent" />
          {isPro ? "You are on Pro" : "Go Pro"}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          100,000 credits a month, unlimited books, and the full publishing
          package export.
        </p>
        {isPro ? (
          <Link href="/dashboard/credits" className="btn btn-sm mt-3 w-full">
            View credit history
          </Link>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm mt-3 w-full"
            onClick={onUpgrade}
          >
            Upgrade plan
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * Support links.
 *
 * Contact Support is a real `mailto:`, so it works. The other three have no
 * destination behind them in this deployment, and rather than point them at a
 * dead route or an invented URL they are rendered as visibly unavailable — a
 * link that 404s is worse than one that says it is not there yet.
 */
const SUPPORT = [
  { label: "Help Center", href: null, Icon: HelpIcon },
  { label: "Video Tutorials", href: null, Icon: PlayIcon },
  { label: "Community", href: null, Icon: UsersIcon },
  { label: "Contact Support", href: "mailto:support@toolstackai.xyz", Icon: HelpIcon },
];

export function SupportLinks() {
  return (
    <section className="card p-4">
      <h2 className="text-sm font-semibold">Support</h2>
      <ul className="mt-2 space-y-0.5">
        {SUPPORT.map(({ label, href, Icon }) =>
          href ? (
            <li key={label}>
              <a
                href={href}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface-2"
              >
                <Icon className="size-4 text-muted" />
                {label}
              </a>
            </li>
          ) : (
            <li key={label}>
              <span
                aria-disabled
                title="Not available in this deployment yet"
                className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-muted/70"
              >
                <Icon className="size-4" />
                {label}
                <span className="ml-auto text-[0.65rem] tracking-wide uppercase">
                  Soon
                </span>
              </span>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
