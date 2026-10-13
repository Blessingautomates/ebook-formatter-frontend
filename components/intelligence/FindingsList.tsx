"use client";

import { useState } from "react";

import { Notice } from "@/components/primitives";
import type { HealthCategory, HealthFinding } from "@/lib/types";

/**
 * The Book Doctor's findings, rendered.
 *
 * The health report has always computed these and nothing has ever shown them:
 * the categories, the per-category availability and the findings inside each
 * one arrived from the API with no surface to land on. This is that surface,
 * deliberately plain — it is a list of things to look at, and the fix for most
 * of them is a decision rather than a button.
 *
 * A category that could not run is shown as such, with its reason, rather than
 * as a category with nothing in it. "Checked and clean" and "never checked"
 * are different answers and the panel keeps them apart.
 */

const SEVERITY_TONE = {
  high: "text-danger",
  medium: "text-warn",
  low: "text-muted",
} as const;

function FindingRow({ finding }: { finding: HealthFinding }) {
  return (
    <li className="rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`text-xs font-semibold ${SEVERITY_TONE[finding.severity] ?? "text-muted"}`}
        >
          {finding.severity}
        </span>
        <span className="text-xs text-faint">
          {finding.chapter} · line {finding.line_number}
        </span>
        {finding.fixable ? (
          <span className="chip" title="This one has a mechanical fix.">
            auto-fixable
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm leading-relaxed">{finding.message}</p>
      {finding.context ? (
        <p className="mt-1 font-serif text-sm leading-relaxed text-muted">
          “{finding.context}”
        </p>
      ) : null}
      {finding.suggestion ? (
        <p className="mt-1 text-xs text-faint">{finding.suggestion}</p>
      ) : null}
    </li>
  );
}

export function FindingsList({
  categories,
  emptyNote,
}: {
  categories: HealthCategory[];
  emptyNote: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (categories.length === 0) {
    return <Notice>{emptyNote}</Notice>;
  }

  return (
    <div className="space-y-3">
      {categories.map((category) => {
        const open = openId === category.id;
        return (
          <div
            key={category.id}
            className="rounded-xl border border-line-strong bg-surface-2"
          >
            <button
              type="button"
              onClick={() => setOpenId(open ? null : category.id)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{category.label}</span>
                {category.available ? (
                  <span className="chip">{category.count}</span>
                ) : (
                  <span className="chip">not checked</span>
                )}
                <span className="text-xs text-faint">{category.group}</span>
              </span>
              <span
                aria-hidden
                className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
              >
                ▾
              </span>
            </button>

            {open ? (
              <div className="border-t border-line px-4 py-4">
                {!category.available ? (
                  <Notice tone="warn">
                    {category.note ??
                      "This check could not run on this manuscript."}
                  </Notice>
                ) : category.findings.length === 0 ? (
                  <Notice tone="ok">Nothing found here.</Notice>
                ) : (
                  <>
                    {category.note ? (
                      <Notice className="mb-3">{category.note}</Notice>
                    ) : null}
                    <ul className="space-y-2">
                      {category.findings.map((finding) => (
                        <FindingRow key={finding.id} finding={finding} />
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
