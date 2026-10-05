"use client";

import { useEffect, useState } from "react";

import { Notice, Spinner } from "@/components/primitives";
import { CloseIcon, ExportIcon, ShieldIcon } from "@/components/shell/icons";
import { downloadPackage, saveApproval } from "@/lib/approvals";
import type { CoverAsset, PaperStock } from "@/lib/covers";
import { estimatedPages, languageLabel, readinessFor, WORDS_PER_PAGE } from "@/lib/readiness";
import type { BookAnalysis, ChapterSummary } from "@/lib/types";

/**
 * The final publication sign-off.
 *
 * This is the last screen before a file exists that someone could upload to a
 * printer, so it is built to be read rather than clicked through: every check
 * the product actually ran is listed with its result, the things that are wrong
 * are stated as warnings rather than hidden, and the download stays disabled
 * until the author has made each of the three statements.
 *
 * The three boxes are separate because they are separate claims. "I have
 * reviewed my manuscript", "I approve the formatting" and "I approve the final
 * export" fail independently — an author can have read every word and still not
 * have looked at the title page. Storing one signature would lose that.
 */

/** One row of the pre-publication summary. */
function CheckRow({
  label,
  value,
  status,
  detail,
}: {
  label: string;
  value: string;
  status: "pass" | "warn" | "fail" | "info";
  detail?: string | null;
}) {
  const tone =
    status === "pass"
      ? "border-ok bg-ok-soft text-ok"
      : status === "warn"
        ? "border-warn bg-warn-soft text-warn"
        : status === "fail"
          ? "border-danger bg-danger-soft text-danger"
          : "border-line bg-surface-2 text-muted";

  const word =
    status === "pass"
      ? "Passed"
      : status === "warn"
        ? "Warning"
        : status === "fail"
          ? "Failed"
          : "Not run";

  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase ${tone}`}
        >
          {word}
        </span>
        <span className="ml-auto font-mono text-[0.7rem] text-muted">{value}</span>
      </div>
      {detail ? (
        <p className="mt-1.5 text-xs leading-relaxed text-muted">{detail}</p>
      ) : null}
    </li>
  );
}

export interface ApprovalInputs {
  manuscriptId: string;
  title: string;
  author: string | null;
  genre: string;
  trimSize: string;
  scriptType: string;
  textDirection: string;
  language: string;
  customFont: string | null;
  fontSize: number | null;
  paper: PaperStock;
  isbn?: string | null;
  /** The edited manuscript — what the archive will contain. */
  text: string;
  /** The original upload, used only when no edited text exists. */
  file: File | null;
  cover: File | null;
  analysis: BookAnalysis | null;
  chapters: ChapterSummary[];
  wordCount: number;
  /** The most recent cover check, or null when the cover was never validated. */
  coverAsset: CoverAsset | null;
}

export function ApprovalModal({
  open,
  onClose,
  inputs,
}: {
  open: boolean;
  onClose: () => void;
  inputs: ApprovalInputs;
}) {
  const [reviewed, setReviewed] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [exported, setExported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delivered, setDelivered] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, busy]);

  // A second book opens a second sign-off; the ticks belong to the book.
  useEffect(() => {
    if (open) {
      setReviewed(false);
      setFormatting(false);
      setExported(false);
      setDelivered(null);
      setError(null);
    }
  }, [open, inputs.manuscriptId]);

  if (!open) return null;

  const { analysis, chapters, wordCount, coverAsset } = inputs;
  const pageCount = analysis?.estimated_pages ?? estimatedPages(wordCount);
  const allTicked = reviewed && formatting && exported;

  const readiness = readinessFor(
    {
      content: inputs.text,
      chapter_count: chapters.length,
      title: inputs.title,
      author: inputs.author,
    },
    { coverReady: coverAsset?.status === "passed", approved: allTicked },
  );

  const typoCount = analysis?.typo_count ?? 0;
  const typoScanRan = analysis?.typo_check_available ?? false;
  const language = languageLabel(analysis?.detected_language ?? inputs.language);
  const failedCover = coverAsset?.status === "failed";
  const coverWarnings =
    coverAsset?.checks.filter((check) => check.status === "warn").length ?? 0;

  /** Things that are true, will not stop the export, and the author should see. */
  const warnings: string[] = [];
  if (!inputs.text.trim()) {
    warnings.push(
      "There is no edited manuscript in this project, so the package will be built from the file you uploaded. Any edits made in the editor that were not saved are not in it.",
    );
  }
  if (!coverAsset) {
    warnings.push(
      "No cover has been checked for this book. The package will contain the manuscript formats only.",
    );
  } else if (failedCover) {
    warnings.push(
      "The last cover check failed its measurements. The package will include the cover as uploaded and the specification beside it.",
    );
  } else if (coverWarnings > 0) {
    warnings.push(
      `The cover passed with ${coverWarnings} warning${coverWarnings === 1 ? "" : "s"} — see the cover panel for what was measured.`,
    );
  }
  if (!typoScanRan) {
    warnings.push(
      analysis?.typo_check_note?.trim() ||
        "The spelling scan did not run on this manuscript, so its typo count is unknown rather than zero.",
    );
  } else if (typoCount > 0) {
    warnings.push(
      `${typoCount} possible typo${typoCount === 1 ? "" : "s"} remain${typoCount === 1 ? "s" : ""} unresolved. These are flagged words, not certain errors — the export does not change them either way.`,
    );
  }
  if (!analysis) {
    warnings.push(
      "This book has no analysis attached, so the checks below are the only ones that ran.",
    );
  }

  async function publish(): Promise<void> {
    if (!allTicked || busy) return;

    setBusy(true);
    setError(null);
    try {
      const filename = await downloadPackage({
        text: inputs.text,
        file: inputs.file,
        cover: inputs.cover,
        title: inputs.title,
        author: inputs.author,
        genre: inputs.genre,
        trimSize: inputs.trimSize,
        scriptType: inputs.scriptType,
        textDirection: inputs.textDirection,
        language: inputs.language,
        customFont: inputs.customFont,
        fontSize: inputs.fontSize,
        pageCount,
        paper: inputs.paper,
        isbn: inputs.isbn ?? null,
      });
      setDelivered(filename);

      /*
       * Recorded after the archive is built, not before. `approved_export` is a
       * statement about a file that exists; signing it first would leave a row
       * claiming approval of an export that failed to render. A failure to
       * store is reported but does not take the file back.
       */
      try {
        await saveApproval({
          manuscriptId: inputs.manuscriptId,
          reviewedManuscript: true,
          approvedFormatting: true,
          approvedExport: true,
        });
      } catch (caught) {
        setError(
          caught instanceof Error && caught.message
            ? `${caught.message} The download above is unaffected.`
            : "The download succeeded but the signature could not be recorded.",
        );
      }
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "The publishing package could not be built.",
      );
    } finally {
      setBusy(false);
    }
  }

  const tick = (
    id: string,
    checked: boolean,
    set: (value: boolean) => void,
    label: string,
    hint: string,
  ) => (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 hover:bg-surface-2"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={busy}
        onChange={(event) => {
          set(event.target.checked);
        }}
        className="mt-0.5 size-4 accent-[var(--color-accent)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">
          {hint}
        </span>
      </span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <button
        type="button"
        aria-label="Close sign-off"
        className="fixed inset-0 bg-black/60"
        onClick={() => {
          if (!busy) onClose();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Final publication sign-off"
        className="relative my-auto w-full max-w-2xl rounded-2xl border border-line bg-paper shadow-2xl"
      >
        <header className="flex items-center gap-3 border-b border-line px-5 py-4">
          <ShieldIcon className="size-5 text-accent" />
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg font-semibold">
              Final publication sign-off
            </h2>
            <p className="text-xs text-muted">
              {inputs.title.trim() || "Untitled"}
              {inputs.author?.trim() ? ` · ${inputs.author.trim()}` : ""} ·{" "}
              {inputs.trimSize.replace("x", " × ")} in
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="btn btn-sm px-2"
          >
            <CloseIcon className="size-4" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          {error ? <Notice tone="error">{error}</Notice> : null}
          {delivered ? (
            <Notice tone="ok">
              <strong className="font-medium">
                Download started: {delivered}
              </strong>{" "}
              It contains every format this server can render, the cover, its
              specification and a metadata file.
            </Notice>
          ) : null}

          {/* ---- what the checks found -------------------------------- */}
          <section className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">Quality checks</h3>
              <span className="text-xs text-muted">
                {readiness.passed} of {readiness.total} steps complete ·{" "}
                {readiness.percent}% ready
              </span>
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${readiness.percent}%` }}
              />
            </div>

            <ul className="space-y-2">
              <CheckRow
                label="Manuscript measured"
                value={
                  wordCount > 0
                    ? `${wordCount.toLocaleString("en-GB")} words · ${pageCount} pages`
                    : "no text"
                }
                status={wordCount > 0 ? "pass" : "fail"}
                detail={
                  wordCount > 0
                    ? `Page count is the analyzer's estimate at ${WORDS_PER_PAGE} words a page, which the spine width and the export both use.`
                    : "Nothing has been measured, so there is no text to package."
                }
              />
              <CheckRow
                label="Chapters detected"
                value={chapters.length > 0 ? `${chapters.length}` : "none"}
                status={chapters.length > 0 ? "pass" : "warn"}
                detail={
                  chapters.length > 0
                    ? `First: ${chapters[0]?.title ?? "—"}`
                    : "No headings were found. The book will export as continuous text with no chapter breaks."
                }
              />
              <CheckRow
                label="Language and script"
                value={language ?? "unknown"}
                status={analysis ? "pass" : "info"}
                detail={
                  analysis
                    ? `${analysis.script_type} script, read ${analysis.text_direction === "rtl" ? "right to left" : "left to right"}. These set the hyphenation and the page direction in the export.`
                    : "No analysis is attached, so the export will use its defaults."
                }
              />
              <CheckRow
                label="Spelling scan"
                value={typoScanRan ? `${typoCount} flagged` : "not run"}
                status={!typoScanRan ? "info" : typoCount > 0 ? "warn" : "pass"}
                detail={analysis?.typo_check_note ?? null}
              />
              <CheckRow
                label="Cover specification"
                value={
                  coverAsset
                    ? `${coverAsset.width_px ?? "?"} × ${coverAsset.height_px ?? "?"} px`
                    : "not checked"
                }
                status={
                  coverAsset?.status === "passed"
                    ? "pass"
                    : coverAsset?.status === "failed"
                      ? "fail"
                      : coverAsset
                        ? "warn"
                        : "info"
                }
                detail={
                  coverAsset
                    ? `${coverAsset.checks.filter((check) => check.status === "pass").length} checks passed, ${coverWarnings} warned, ${coverAsset.checks.filter((check) => check.status === "fail").length} failed.`
                    : "The cover has not been measured against the trim, bleed and spine for this book."
                }
              />
            </ul>
          </section>

          {/* ---- what is still wrong ---------------------------------- */}
          {warnings.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">
                Before you approve{" "}
                <span className="font-normal text-muted">
                  ({warnings.length})
                </span>
              </h3>
              <Notice tone="warn">
                <ul className="list-disc space-y-1.5 pl-4">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </Notice>
              <p className="text-xs text-muted">
                None of these stop the export. They are here so that approving it
                is a decision rather than an oversight.
              </p>
            </section>
          ) : null}

          {/* ---- the three statements --------------------------------- */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">
              Sign off on this book
            </h3>
            <div className="space-y-2">
              {tick(
                "signoff-reviewed",
                reviewed,
                setReviewed,
                "I have reviewed my manuscript",
                "The text in this book is the text I want published, and I have read the chapters the analyzer found.",
              )}
              {tick(
                "signoff-formatting",
                formatting,
                setFormatting,
                "I approve the formatting",
                `${inputs.trimSize.replace("x", " × ")} in, ${inputs.genre}, ${inputs.customFont?.trim() || "the default typeface"}${inputs.fontSize ? ` at ${inputs.fontSize}pt` : ""}, with the front matter and chapter styling as exported.`,
              )}
              {tick(
                "signoff-export",
                exported,
                setExported,
                "I approve the final export",
                "The package may be built and downloaded. This is the file that will be uploaded to a printer or a store.",
              )}
            </div>
          </section>
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-4">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!allTicked || busy}
            onClick={() => void publish()}
          >
            {busy ? <Spinner /> : <ExportIcon className="size-4" />}
            Download Complete Publishing Package (.ZIP)
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={onClose}
          >
            {delivered ? "Close" : "Not yet"}
          </button>
          {!allTicked ? (
            <p className="text-xs text-muted">
              Tick all three statements to enable the download.
            </p>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
