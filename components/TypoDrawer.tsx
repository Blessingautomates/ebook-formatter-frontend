"use client";

import { useMemo, useState } from "react";
import type { Decisions, TypoRow } from "@/lib/typos";
import { countDecisions } from "@/lib/typos";
import { Notice } from "./primitives";

/** Wrap every occurrence of `word` inside a context snippet. */
function Context({ text, word }: { text: string; word: string }) {
  const parts = useMemo(() => {
    if (!word) return [text];
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return text.split(new RegExp(`(${escaped})`, "giu"));
  }, [text, word]);

  const target = word.toLowerCase();
  return (
    <p className="font-serif text-sm leading-relaxed text-muted">
      {parts.map((part, index) =>
        part.toLowerCase() === target ? (
          <mark key={index} className="typo-mark">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </p>
  );
}

type Filter = "all" | "pending" | "names";

export function TypoDrawer({
  open,
  onToggle,
  available,
  note,
  totalCount,
  listedCount,
  rows,
  decisions,
  onDecide,
  onBulk,
  appliedCount,
}: {
  open: boolean;
  onToggle: () => void;
  available: boolean;
  note: string | null;
  /** Occurrences the backend counted, before any capping. */
  totalCount: number;
  /** Entries the backend actually returned. */
  listedCount: number;
  rows: TypoRow[];
  decisions: Decisions;
  onDecide: (key: string, decision: Decisions[string] | null) => void;
  onBulk: (keys: string[], decision: Decisions[string] | null) => void;
  appliedCount: number;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const counts = countDecisions(rows, decisions);

  const shown = useMemo(() => {
    if (filter === "pending") {
      return rows.filter((row) => !decisions[row.key]);
    }
    if (filter === "names") {
      return rows.filter((row) => row.likely_proper_noun);
    }
    return rows;
  }, [rows, decisions, filter]);

  const shownKeys = shown.map((row) => row.key);
  // Compared against what the backend returned, not against the deduped rows:
  // several occurrences of one word on one line collapse into a single row, and
  // that is not truncation.
  const truncated = totalCount > listedCount;

  return (
    <div className="mt-4 rounded-xl border border-line bg-surface-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Typo inspection</span>
          {available ? (
            <>
              <span className="chip">
                {counts.pending} undecided
              </span>
              {counts.fixed > 0 ? (
                <span className="chip text-ok">{counts.fixed} to fix</span>
              ) : null}
              {counts.ignored > 0 ? (
                <span className="chip">{counts.ignored} ignored</span>
              ) : null}
            </>
          ) : (
            <span className="chip">not available</span>
          )}
        </span>
        <span
          aria-hidden
          className={`shrink-0 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {open ? (
        <div className="border-t border-line px-4 py-4">
          {!available ? (
            <Notice tone="warn">
              {note ??
                "The spell checker has no dictionary for this manuscript's language, so no typo scan was run."}
            </Notice>
          ) : rows.length === 0 ? (
            <Notice tone="ok">
              No suspected misspellings were found in this manuscript.
            </Notice>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {(
                  [
                    ["all", `All ${rows.length}`],
                    ["pending", `Undecided ${counts.pending}`],
                    [
                      "names",
                      `Possible names ${rows.filter((r) => r.likely_proper_noun).length}`,
                    ],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    aria-pressed={filter === value}
                    className={`btn btn-sm ${filter === value ? "btn-primary" : ""}`}
                  >
                    {label}
                  </button>
                ))}

                <span className="mx-1 hidden h-5 w-px bg-line-strong sm:block" />

                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={shownKeys.length === 0}
                  onClick={() =>
                    onBulk(
                      shownKeys,
                      { action: "fix", replacement: "" }, // empty means "top suggestion"
                    )
                  }
                >
                  Fix all shown
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={shownKeys.length === 0}
                  onClick={() => onBulk(shownKeys, { action: "ignore" })}
                >
                  Ignore all shown
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={counts.fixed + counts.ignored === 0}
                  onClick={() => onBulk(rows.map((row) => row.key), null)}
                >
                  Clear
                </button>
              </div>

              {truncated ? (
                <Notice className="mb-3">
                  The scan counted {totalCount} occurrences and the API returned
                  the first {listedCount}. Deciding on these does not cover the
                  rest.
                </Notice>
              ) : null}

              {appliedCount > 0 ? (
                <Notice tone="ok" className="mb-3">
                  {appliedCount} correction{appliedCount === 1 ? "" : "s"} will
                  be applied to the exported manuscript.
                </Notice>
              ) : null}

              <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {shown.map((row) => {
                  const decision = decisions[row.key];
                  const chosen =
                    decision?.action === "fix"
                      ? decision.replacement || row.suggestions[0]
                      : null;
                  return (
                    <li
                      key={row.key}
                      className="rounded-lg border border-line bg-surface px-3 py-2.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-semibold">
                              {row.word}
                            </span>
                            {row.likely_proper_noun ? (
                              <span
                                className="chip"
                                title="Capitalised somewhere other than the start of a sentence, so it may be a name rather than a mistake."
                              >
                                possibly a name
                              </span>
                            ) : null}
                            <span className="text-xs text-faint">
                              {row.chapter} · line {row.line_number}
                            </span>
                          </div>

                          <div className="mt-1.5">
                            <Context text={row.context} word={row.word} />
                          </div>

                          {row.suggestions.length > 0 ? (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span className="text-xs text-faint">
                                Replace with
                              </span>
                              {row.suggestions.map((suggestion) => (
                                <button
                                  key={suggestion}
                                  type="button"
                                  onClick={() =>
                                    onDecide(row.key, {
                                      action: "fix",
                                      replacement: suggestion,
                                    })
                                  }
                                  className={`btn btn-sm ${
                                    chosen === suggestion ? "btn-primary" : ""
                                  }`}
                                >
                                  {suggestion}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1.5 text-xs text-faint">
                              No suggestions offered for this word.
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 gap-1.5">
                          <button
                            type="button"
                            aria-pressed={decision?.action === "fix"}
                            disabled={row.suggestions.length === 0}
                            title={
                              row.suggestions.length === 0
                                ? "This word has no suggestions to apply."
                                : "Use the top suggestion; pick another below to change it."
                            }
                            onClick={() =>
                              onDecide(
                                row.key,
                                // Clicking Fix again clears the decision, so the
                                // toggle works in both directions.
                                decision?.action === "fix" &&
                                  !decision.replacement
                                  ? null
                                  : {
                                      action: "fix",
                                      replacement:
                                        decision?.action === "fix"
                                          ? decision.replacement
                                          : "",
                                    },
                              )
                            }
                            className={`btn btn-sm ${
                              decision?.action === "fix" ? "btn-primary" : ""
                            }`}
                          >
                            Fix
                          </button>
                          <button
                            type="button"
                            aria-pressed={decision?.action === "ignore"}
                            onClick={() =>
                              onDecide(
                                row.key,
                                decision?.action === "ignore"
                                  ? null
                                  : { action: "ignore" },
                              )
                            }
                            className={`btn btn-sm ${
                              decision?.action === "ignore" ? "btn-primary" : ""
                            }`}
                          >
                            Ignore
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
