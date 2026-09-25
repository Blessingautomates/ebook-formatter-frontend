"use client";

import type { ExportFormat, TrimSize } from "@/lib/types";
import { TRIM_OPTIONS } from "@/lib/genres";
import { Notice, Spinner } from "./primitives";

interface FormatInfo {
  id: ExportFormat;
  label: string;
  note: string;
}

/** PDF is the primary action; these four sit in the convert bar. */
const SECONDARY: FormatInfo[] = [
  { id: "epub", label: "EPUB", note: "Reflowable, for Kindle and Apple Books" },
  { id: "docx", label: "DOCX", note: "Editable in Word" },
  { id: "rtf", label: "RTF", note: "Editable in most word processors" },
  { id: "txt", label: "TXT", note: "Plain text, wrapped at 72 columns" },
];

export function ExportHub({
  trimSize,
  exporting,
  error,
  lastExport,
  onExport,
}: {
  trimSize: TrimSize;
  exporting: ExportFormat | null;
  error: string | null;
  lastExport: string | null;
  onExport: (format: ExportFormat) => void;
}) {
  const trim = TRIM_OPTIONS.find((option) => option.id === trimSize);
  const busy = exporting !== null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line-strong bg-surface-2 p-4">
        <button
          type="button"
          className="btn btn-primary px-5 py-2.5 text-base"
          disabled={busy}
          onClick={() => onExport("pdf")}
        >
          {exporting === "pdf" ? <Spinner /> : null}
          {exporting === "pdf" ? "Rendering…" : "Download PDF"}
        </button>
        <div className="text-sm text-muted">
          <div className="font-medium text-ink">
            {trim ? `${trim.label} · ${trim.detail}` : trimSize}
          </div>
          <div className="text-xs">
            Rendered by WeasyPrint with the print stylesheet.
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[0.7rem] font-semibold tracking-wider text-faint uppercase">
          Convert to another format
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SECONDARY.map((format) => (
            <button
              key={format.id}
              type="button"
              className="btn flex-col items-start gap-0.5 px-3 py-2.5 text-left"
              disabled={busy}
              onClick={() => onExport(format.id)}
            >
              <span className="flex items-center gap-2 font-medium">
                {exporting === format.id ? <Spinner className="size-3.5" /> : null}
                {format.label}
              </span>
              <span className="text-xs font-normal text-muted">
                {exporting === format.id ? "Rendering…" : format.note}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      ) : null}

      {lastExport && !error ? (
        <Notice tone="ok" className="mt-3">
          Saved <span className="font-medium">{lastExport}</span>.
        </Notice>
      ) : null}
    </div>
  );
}
