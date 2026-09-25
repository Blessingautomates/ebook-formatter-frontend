"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AdvancedSettings } from "@/components/AdvancedSettings";
import { AnalysisDashboard } from "@/components/AnalysisDashboard";
import { Dropzone } from "@/components/Dropzone";
import { ExportHub } from "@/components/ExportHub";
import { GenreSelector } from "@/components/GenreSelector";
import { TypoDrawer } from "@/components/TypoDrawer";
import { Notice, Step } from "@/components/primitives";
import { analyzeBook, exportBook } from "@/lib/api";
import { applyFixes, buildRows, type Decision, type Decisions } from "@/lib/typos";
import type { BookAnalysis, ExportFormat, ExportSettings } from "@/lib/types";

type Status = "idle" | "analyzing" | "ready";

const INITIAL_SETTINGS: ExportSettings = {
  title: "",
  author: "",
  genre: "fiction",
  trimSize: "6x9",
  customFont: "",
  fontSize: null,
};

/** "my-book_draft.docx" becomes "my book draft". */
function titleFromFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim() || "Untitled";
}

function messageFor(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function DashboardPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<BookAnalysis | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const [decisions, setDecisions] = useState<Decisions>({});
  const [typosOpen, setTyposOpen] = useState(false);

  const [settings, setSettings] = useState<ExportSettings>(INITIAL_SETTINGS);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);

  const rows = useMemo(() => buildRows(analysis?.typos ?? []), [analysis]);

  /**
   * The manuscript with every accepted correction applied. Recomputed as the
   * decisions change; null when the server did not return the text, in which
   * case the export falls back to re-uploading the original file.
   */
  const corrected = useMemo(() => {
    const text = analysis?.manuscript_text;
    if (!text) return { text: null, applied: 0 };
    const result = applyFixes(text, rows, decisions);
    return { text: result.text, applied: result.applied };
  }, [analysis, rows, decisions]);

  function reset(): void {
    setFile(null);
    setAnalysis(null);
    setStatus("idle");
    setError(null);
    setDecisions({});
    setTyposOpen(false);
    setExporting(null);
    setExportError(null);
    setLastExport(null);
  }

  async function handleFile(next: File): Promise<void> {
    setFile(next);
    setAnalysis(null);
    setDecisions({});
    setExportError(null);
    setLastExport(null);
    setError(null);
    setStatus("analyzing");
    setSettings((current) => ({
      ...current,
      title: current.title || titleFromFilename(next.name),
    }));

    try {
      const result = await analyzeBook(next);
      setAnalysis(result);
      setStatus("ready");
      // Open the drawer straight away when there is something to review.
      setTyposOpen(result.typo_check_available && result.typo_count > 0);
    } catch (caught) {
      setError(messageFor(caught, "The manuscript could not be analyzed."));
      setStatus("idle");
    }
  }

  function decide(key: string, decision: Decision | null): void {
    setDecisions((current) => {
      const next = { ...current };
      if (decision) next[key] = decision;
      else delete next[key];
      return next;
    });
  }

  function bulk(keys: string[], decision: Decision | null): void {
    setDecisions((current) => {
      const next = { ...current };
      for (const key of keys) {
        if (decision) next[key] = decision;
        else delete next[key];
      }
      return next;
    });
  }

  async function handleExport(format: ExportFormat): Promise<void> {
    if (!analysis) return;
    setExporting(format);
    setExportError(null);
    setLastExport(null);
    try {
      const filename = await exportBook({
        text: corrected.text,
        file,
        analysis,
        settings,
        format,
      });
      setLastExport(filename);
    } catch (caught) {
      setExportError(messageFor(caught, "The export failed."));
    } finally {
      setExporting(null);
    }
  }

  const ready = analysis !== null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            <Link href="/" className="transition-colors hover:text-accent">
              Ebook Formatter
            </Link>
          </h1>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-medium text-muted transition-colors hover:text-accent"
            >
              ← Home
            </Link>
            <span className="font-mono text-xs text-faint">
              format.toolstackai.xyz
            </span>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Upload a manuscript to measure it, review the spelling findings, pick a
          genre, then export a print-ready PDF or convert to EPUB, DOCX, RTF or
          TXT.
        </p>
      </header>

      <div className="space-y-5">
        <Step
          n={1}
          title="Manuscript"
          hint="A .docx, .md or .txt file."
          aside={
            file && status === "ready" ? (
              <button type="button" className="btn btn-sm" onClick={reset}>
                Start over
              </button>
            ) : null
          }
        >
          <Dropzone
            file={file}
            busy={status === "analyzing"}
            error={error}
            onFile={handleFile}
            onInvalid={setError}
            onReset={reset}
          />
        </Step>

        {analysis ? (
          <Step
            n={2}
            title="Pre-scan"
            hint={`Measured from ${analysis.language_name}, ${analysis.script_type} script.`}
          >
            <AnalysisDashboard
              analysis={analysis}
              onOpenTypos={() => setTyposOpen((open) => !open)}
            />
            <TypoDrawer
              open={typosOpen}
              onToggle={() => setTyposOpen((open) => !open)}
              available={analysis.typo_check_available}
              note={analysis.typo_check_note}
              totalCount={analysis.typo_count}
              listedCount={analysis.typos.length}
              rows={rows}
              decisions={decisions}
              onDecide={decide}
              onBulk={bulk}
              appliedCount={corrected.applied}
            />
          </Step>
        ) : null}

        <Step
          n={3}
          title="Genre and layout"
          hint="Sets the typography and page furniture of the export."
          active={ready}
        >
          <GenreSelector
            value={settings.genre}
            onChange={(genre) => setSettings((s) => ({ ...s, genre }))}
          />
          <div className="mt-3">
            <AdvancedSettings
              settings={settings}
              onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
            />
          </div>
        </Step>

        <Step
          n={4}
          title="Export"
          hint="Each format downloads as soon as it finishes rendering."
          active={ready}
        >
          {ready ? (
            <ExportHub
              trimSize={settings.trimSize}
              exporting={exporting}
              error={exportError}
              lastExport={lastExport}
              onExport={handleExport}
            />
          ) : (
            <Notice>Analyze a manuscript to enable export.</Notice>
          )}
        </Step>
      </div>

      <footer className="mt-10 border-t border-line pt-5 text-xs leading-relaxed text-faint">
        Requests go to the FastAPI backend through this app&rsquo;s{" "}
        <code className="font-mono">/api</code> proxy, so the manuscript is
        analysed and rendered server-side. A format is unavailable if its
        renderer is not installed on the server; the error names the missing
        package.
      </footer>
    </main>
  );
}
