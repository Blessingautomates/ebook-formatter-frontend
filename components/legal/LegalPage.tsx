import Link from "next/link";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";

/**
 * The shell the three policy pages share.
 *
 * /privacy, /terms and /refunds differ only in their prose, so the chrome —
 * container width, heading, effective date, footer — lives here rather than
 * three times over. That also means the footer's legal links cannot go missing
 * from one of the pages they exist for.
 *
 * These are server components: the text is static and there is nothing to
 * hydrate, so shipping it as HTML keeps the pages that a payment provider's
 * reviewer reads as light as possible.
 */
export function LegalPage({
  title,
  summary,
  updated,
  children,
}: {
  title: string;
  summary: string;
  /** Rendered inside `LegalPlaceholder` — see the note on that component. */
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-8 sm:px-6 lg:px-8">
        <header className="space-y-2">
          <Link
            href="/"
            className="text-xs font-medium text-muted underline decoration-line-strong underline-offset-2 transition-colors hover:text-ink"
          >
            ← Back to ToolStackAI Book Studio
          </Link>
          <h1 className="font-serif text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted">{summary}</p>
          <p className="text-xs text-faint">
            Effective date: <LegalPlaceholder>{updated}</LegalPlaceholder>
          </p>
        </header>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

/** One numbered or headed block of policy prose. */
export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="card space-y-2 px-4 py-4">
      <h2 className="font-serif text-base font-semibold">{heading}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}

/**
 * A value that is *not yet true* and must be replaced before this is submitted
 * for payment-provider review.
 *
 * It is deliberately loud — a coloured, monospaced bracket rather than an
 * inconspicuous italic — because the failure mode of a legal placeholder is
 * that it ships. Nothing here invents a company, a registration or an address.
 */
export function LegalPlaceholder({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-warn bg-warn-soft px-1 font-mono text-warn">
      [{children}]
    </span>
  );
}

/**
 * The list of placeholders a page still needs, collected in one block so they
 * are impossible to miss when reviewing the page.
 */
export function LegalTodo({ items }: { items: string[] }) {
  return (
    <section className="rounded-xl border border-warn bg-warn-soft px-4 py-3.5">
      <h2 className="text-xs font-semibold tracking-wider text-warn uppercase">
        TODO(legal) — to be completed before submission
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-warn">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
