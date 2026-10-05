"use client";

import { useEffect, useRef, useState } from "react";

import { Notice, Spinner } from "@/components/primitives";
import { CloseIcon, UploadIcon } from "@/components/shell/icons";
import {
  ACCEPTED_COVER_TYPES,
  hasCoverExtension,
  PAPER_LABELS,
  saveCoverAsset,
  uploadCoverFile,
  validateCover,
  type CoverValidation,
  type PaperStock,
} from "@/lib/covers";
import { createClient } from "@/lib/supabase/client";
import type { TrimSize } from "@/lib/types";

/** The three verdicts, as the brief names them. */
const STATUS_LABEL: Record<string, string> = {
  pass: "Passed",
  warn: "Warning",
  fail: "Failed",
};

const STATUS_STYLE: Record<string, string> = {
  pass: "border-ok bg-ok-soft text-ok",
  warn: "border-warn bg-warn-soft text-warn",
  fail: "border-danger bg-danger-soft text-danger",
};

const OVERALL: Record<string, { label: string; tone: string }> = {
  passed: { label: "Passed", tone: "border-ok bg-ok-soft text-ok" },
  warnings: { label: "Passed with warnings", tone: "border-warn bg-warn-soft text-warn" },
  failed: { label: "Failed", tone: "border-danger bg-danger-soft text-danger" },
};

/**
 * The bleed, trim and safe-area guides, drawn over the cover preview.
 *
 * The geometry is derived from the specification the backend returned rather
 * than hard-coded, so the guides move when the trim size or page count does.
 * Every value is a percentage of the full cover, which is what makes the
 * overlay scale to whatever the preview's rendered size happens to be.
 *
 * What it cannot do is verify the artwork. The lines show where the trim will
 * fall and where text has to stay inside; an image that is white in its outer
 * eighth of an inch passes every measurement and still loses its border when
 * the book is trimmed. That is why the guides are drawn rather than asserted
 * about.
 */
function CoverGuides({ spec }: { spec: CoverValidation["specification"] }) {
  const { full_width_in: w, full_height_in: h } = spec;

  const bleedX = (spec.bleed_in / w) * 100;
  const bleedY = (spec.bleed_in / h) * 100;
  const safeX = (spec.safe_area_in / w) * 100;
  const safeY = (spec.safe_area_in / h) * 100;

  const spineLeft = ((spec.bleed_in + spec.trim_width_in) / w) * 100;
  const spineRight =
    ((spec.bleed_in + spec.trim_width_in + spec.spine_width_in) / w) * 100;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {/* Trim: where the guillotine falls. */}
      <div
        className="absolute border border-dashed border-white/70"
        style={{ left: `${bleedX}%`, right: `${bleedX}%`, top: `${bleedY}%`, bottom: `${bleedY}%` }}
      />

      {/* The spine band, between the two covers. */}
      <div
        className="absolute bg-white/15"
        style={{ left: `${spineLeft}%`, width: `${spineRight - spineLeft}%`, top: `${bleedY}%`, bottom: `${bleedY}%` }}
      />

      {/* Safe area: text and logos stay inside these. */}
      <div
        className="absolute border border-dotted border-white/50"
        style={{
          left: `${spineLeft - (spec.trim_width_in / w) * 100 + safeX}%`,
          width: `${(spec.trim_width_in / w) * 100 - safeX * 2}%`,
          top: `${bleedY + safeY}%`,
          bottom: `${bleedY + safeY}%`,
        }}
      />
      <div
        className="absolute border border-dotted border-white/50"
        style={{
          left: `${spineRight + safeX}%`,
          width: `${(spec.trim_width_in / w) * 100 - safeX * 2}%`,
          top: `${bleedY + safeY}%`,
          bottom: `${bleedY + safeY}%`,
        }}
      />
    </div>
  );
}

/**
 * Cover upload and specification inspection.
 *
 * The file is measured by the backend, not trusted: dimensions and resolution
 * are read from the pixels, the spine is computed from the book's page count,
 * and bleed and safe area are checked against the arithmetic. Each check
 * reports what was measured against what is required, so a failure says what to
 * change rather than only that something is wrong.
 */
export function CoverDrawer({
  open,
  onClose,
  manuscriptId,
  trimSize,
  pageCount,
  paper,
  onPaperChange,
  onValidated,
}: {
  open: boolean;
  onClose: () => void;
  manuscriptId: string;
  trimSize: TrimSize;
  pageCount: number;
  /** Controlled, because the packaging step writes the same stock. */
  paper: PaperStock;
  onPaperChange: (paper: PaperStock) => void;
  /** Called after a check passes, so the book can carry the file and the result. */
  onValidated?: (validation: CoverValidation, file: File) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<CoverValidation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dragging, setDragging] = useState(false);

  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Object URLs leak until revoked, and the preview changes on every upload.
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function accept(candidate: File): void {
    if (!hasCoverExtension(candidate.name)) {
      setError("A cover must be a JPEG, PNG, TIFF or WebP image.");
      return;
    }
    setError(null);
    setResult(null);
    setSaved(false);
    setFile(candidate);
  }

  async function check(): Promise<void> {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const validation = await validateCover(file, { trimSize, pageCount, paper });
      setResult(validation);
      onValidated?.(validation, file);

      /*
       * Stored so the book's readiness survives a reload. A failure to store is
       * reported but does not discard the measurement — the user can see the
       * result either way, and the check is the expensive part.
       */
      try {
        const {
          data: { user },
        } = await createClient().auth.getUser();
        const path = user
          ? await uploadCoverFile(file, user.id, manuscriptId)
          : null;
        await saveCoverAsset({ manuscriptId, storagePath: path, validation });
        setSaved(true);
      } catch (caught) {
        setError(
          caught instanceof Error && caught.message
            ? `${caught.message} The check above is still valid.`
            : "The cover was checked but could not be saved.",
        );
      }
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "The cover could not be checked.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const spec = result?.specification ?? null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close cover inspection"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cover upload and validation"
        className="relative flex h-full w-full max-w-xl flex-col border-l border-line bg-paper shadow-2xl"
      >
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Cover specification</h2>
            <p className="text-xs text-muted">
              {trimSize.replace("x", " × ")} in · {pageCount} pages ·{" "}
              {PAPER_LABELS[paper]} paper
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="btn btn-sm px-2"
          >
            <CloseIcon className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {error ? <Notice tone="error">{error}</Notice> : null}
          {saved ? <Notice tone="ok">Cover checked and saved.</Notice> : null}

          {/* ---- the drop zone ------------------------------------------- */}
          <div
            onDragEnter={(event) => {
              event.preventDefault();
              depth.current += 1;
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              event.preventDefault();
              // Counting enter/leave pairs: dragging over a child fires a leave
              // on the parent, which would otherwise clear the highlight.
              depth.current -= 1;
              if (depth.current <= 0) setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              depth.current = 0;
              setDragging(false);
              const dropped = event.dataTransfer.files?.[0];
              if (dropped) accept(dropped);
            }}
            className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
              dragging ? "border-accent bg-accent-soft" : "border-line bg-surface-2"
            }`}
          >
            <input
              ref={input}
              type="file"
              accept={ACCEPTED_COVER_TYPES.join(",")}
              className="sr-only"
              onChange={(event) => {
                const chosen = event.target.files?.[0];
                if (chosen) accept(chosen);
                // Cleared so choosing the same file twice fires a change event.
                event.target.value = "";
              }}
            />
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => input.current?.click()}
            >
              <UploadIcon className="size-4" />
              {file ? "Choose a different cover" : "Upload a cover"}
            </button>
            <p className="mt-2 text-xs text-muted">
              {file
                ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`
                : "Full cover: back, spine and front in one image, with bleed."}
            </p>
          </div>

          {/* ---- the preview, with guides --------------------------------- */}
          {(preview || spec) && (
            <div className="space-y-2">
              <div className="relative overflow-hidden rounded-lg border border-line bg-[#1b1b1b]">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview}
                    alt="The uploaded cover"
                    className="block max-h-72 w-full object-contain"
                  />
                ) : (
                  <div className="grid h-40 place-items-center text-xs text-white/70">
                    Upload a cover to see it against the guides
                  </div>
                )}
                {spec ? <CoverGuides spec={spec} /> : null}
              </div>

              {spec ? (
                <p className="text-[0.7rem] leading-relaxed text-muted">
                  Dashed white: the trim line. Shaded band: the{" "}
                  {spec.spine_width_in.toFixed(4)} in spine. Dotted: the{" "}
                  {spec.safe_area_in} in safe area. Keep text and logos inside the
                  dotted boxes.
                </p>
              ) : null}
            </div>
          )}

          {/* ---- paper stock --------------------------------------------- */}
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="paper" className="text-xs text-muted">
              Paper stock
            </label>
            <select
              id="paper"
              value={paper}
              onChange={(event) => {
                onPaperChange(event.target.value as PaperStock);
                // The spine changes with the paper, so a previous result no
                // longer describes this book.
                setResult(null);
                setSaved(false);
              }}
              className="field w-32"
            >
              {(Object.keys(PAPER_LABELS) as PaperStock[]).map((stock) => (
                <option key={stock} value={stock}>
                  {PAPER_LABELS[stock]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!file || busy}
              onClick={() => void check()}
            >
              {busy ? <Spinner /> : null}
              Check the specification
            </button>
          </div>

          {/* ---- the results --------------------------------------------- */}
          {result ? (
            <div className="space-y-3">
              <div
                className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                  OVERALL[result.status]?.tone ?? ""
                }`}
              >
                {OVERALL[result.status]?.label ?? result.status}
                <span className="ml-2 text-xs font-normal">
                  {result.width_px} × {result.height_px} px
                  {result.dpi ? ` · tagged ${result.dpi} DPI` : " · no DPI tag"}
                </span>
              </div>

              <ul className="space-y-2">
                {result.checks.map((item) => (
                  <li key={item.id} className="rounded-xl border border-line p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{item.label}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase ${
                          STATUS_STYLE[item.status] ?? ""
                        }`}
                      >
                        {STATUS_LABEL[item.status] ?? item.status}
                      </span>
                      <span className="ml-auto font-mono text-[0.7rem] text-muted">
                        {item.measured} / {item.required}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted">
                      {item.message}
                    </p>
                  </li>
                ))}
              </ul>

              {spec ? (
                <dl className="card space-y-1 p-3 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">Full cover</dt>
                    <dd>
                      {spec.full_width_in} × {spec.full_height_in} in
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">Required pixels</dt>
                    <dd>
                      {spec.required_width_px} × {spec.required_height_px}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">Spine</dt>
                    <dd>{spec.spine_width_in} in</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">Bleed / safe area</dt>
                    <dd>
                      {spec.bleed_in} in / {spec.safe_area_in} in
                    </dd>
                  </div>
                </dl>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
