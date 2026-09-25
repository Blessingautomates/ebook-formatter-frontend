"use client";

import type { ReactNode } from "react";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

// Full-strength borders: at /40 the edge of a notice dissolved into the surface
// behind it, which is exactly the faintness this pass removes.
const NOTICE_TONES = {
  error: "border-danger bg-danger-soft text-danger",
  warn: "border-warn bg-warn-soft text-warn",
  info: "border-line-strong bg-surface-2 text-muted",
  ok: "border-ok bg-ok-soft text-ok",
} as const;

export function Notice({
  tone = "info",
  children,
  className = "",
}: {
  tone?: keyof typeof NOTICE_TONES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={`rounded-lg border px-3 py-2 text-sm ${NOTICE_TONES[tone]} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * One numbered step. Steps after the first stay visibly inactive until the
 * analysis exists, so the order of operations is visible without disabling
 * everything up front.
 *
 * Inactive is a dashed border on the inset surface, not a reduced opacity: at
 * opacity-45 the hint text fell well under 4.5:1 and the whole card looked
 * half-rendered rather than deliberately not-yet.
 */
export function Step({
  n,
  title,
  hint,
  aside,
  active = true,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  aside?: ReactNode;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`card p-5 sm:p-6 ${
        active ? "" : "card-inactive pointer-events-none"
      }`}
      aria-disabled={!active}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold ${
              active
                ? "border-accent bg-accent-soft text-accent"
                : "border-line-strong bg-surface text-muted"
            }`}
          >
            {n}
          </span>
          <div>
            <h2 className="font-serif text-lg leading-tight font-semibold">
              {title}
            </h2>
            {hint ? (
              <p className="mt-0.5 text-sm text-muted">{hint}</p>
            ) : null}
          </div>
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-3.5 py-3">
      <div className="text-[0.7rem] font-semibold tracking-wider text-faint uppercase">
        {label}
      </div>
      <div className="mt-1 font-serif text-2xl leading-none font-semibold tabular-nums">
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

export function Chip({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className="chip" title={title}>
      {children}
    </span>
  );
}
