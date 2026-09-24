"use client";

import type { BookAnalysis, ScriptType } from "@/lib/types";
import { Chip, Notice, Stat } from "./primitives";

const SCRIPT_LABELS: Record<ScriptType, string> = {
  latin: "Latin",
  // The backend's "rtl" script value covers Arabic, Urdu, Persian and Hebrew.
  rtl: "Arabic / Hebrew",
  cjk: "CJK",
  cyrillic: "Cyrillic",
  greek: "Greek",
  devanagari: "Devanagari",
};

const number = new Intl.NumberFormat();

export function AnalysisDashboard({
  analysis,
  onOpenTypos,
}: {
  analysis: BookAnalysis;
  onOpenTypos: () => void;
}) {
  const typosChecked = analysis.typo_check_available;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Words" value={number.format(analysis.word_count)} />
        <Stat label="Chapters" value={number.format(analysis.chapter_count)} />
        <Stat
          label="Est. pages"
          value={number.format(analysis.estimated_pages)}
          sub="at 250 words/page"
        />
        <Stat
          label="Token cost"
          value={number.format(analysis.token_cost)}
          sub="10 + words/1k + 2/chapter"
        />
        <button
          type="button"
          onClick={onOpenTypos}
          className="rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-left transition-colors hover:border-accent"
        >
          <div className="text-[0.7rem] font-semibold tracking-wider text-faint uppercase">
            Possible typos
          </div>
          <div className="mt-1 font-serif text-2xl leading-none font-semibold tabular-nums">
            {typosChecked ? number.format(analysis.typo_count) : "—"}
          </div>
          <div className="mt-1 text-xs text-accent">
            {typosChecked ? "Review →" : "Not checked — why? →"}
          </div>
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Chip title="Detected by langdetect">
          {analysis.language_name}{" "}
          <span className="text-faint">{analysis.detected_language}</span>
        </Chip>
        <Chip>{SCRIPT_LABELS[analysis.script_type] ?? analysis.script_type}</Chip>
        <Chip>
          {analysis.text_direction === "rtl"
            ? "Right-to-left"
            : "Left-to-right"}
        </Chip>
        <Chip title="Drives the export's page geometry and running heads">
          {analysis.text_direction === "rtl"
            ? "Gutter on the right"
            : "Gutter on the left"}
        </Chip>
      </div>

      {!analysis.manuscript_text ? (
        <Notice tone="warn" className="mt-3">
          The server did not return the manuscript text, so accepted typo
          corrections cannot be applied and the original file will be re-sent
          for each export.
        </Notice>
      ) : null}
    </div>
  );
}
