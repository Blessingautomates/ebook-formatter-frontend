"use client";

import { useRef, useState } from "react";
import { ACCEPTED_EXTENSIONS, hasAcceptedExtension } from "@/lib/api";
import { Notice, Spinner } from "./primitives";

const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(",");

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

export function Dropzone({
  file,
  busy,
  error,
  onFile,
  onInvalid,
  onReset,
}: {
  file: File | null;
  busy: boolean;
  error: string | null;
  onFile: (file: File) => void;
  onInvalid: (message: string) => void;
  onReset: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  // Drag events fire for every child element, so nesting is counted rather than
  // toggled, otherwise the highlight flickers as the pointer moves inside.
  const depth = useRef(0);

  function accept(candidate: File | undefined) {
    if (!candidate) return;
    if (!hasAcceptedExtension(candidate.name)) {
      onInvalid(
        `"${candidate.name}" is not a supported file. Upload ${ACCEPTED_EXTENSIONS.join(", ")}.`,
      );
      return;
    }
    onFile(candidate);
  }

  return (
    <div>
      <label
        onDragEnter={(event) => {
          event.preventDefault();
          depth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          depth.current -= 1;
          if (depth.current <= 0) {
            depth.current = 0;
            setDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          depth.current = 0;
          setDragging(false);
          if (busy) return;
          accept(event.dataTransfer.files?.[0]);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging
            ? "border-accent bg-accent-soft"
            : "border-line-strong bg-surface-2 hover:border-accent"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          type="file"
          className="sr-only"
          accept={ACCEPT_ATTR}
          disabled={busy}
          onChange={(event) => {
            accept(event.target.files?.[0]);
            // Reset so re-picking the same file fires change again.
            event.target.value = "";
          }}
        />
        {busy ? (
          <>
            <Spinner className="size-5 text-accent" />
            <span className="text-sm font-medium">Analyzing…</span>
            <span className="text-xs text-muted">
              Extracting text, counting chapters and scanning for typos.
            </span>
          </>
        ) : (
          <>
            <span className="font-serif text-base font-medium">
              Drop a manuscript here
            </span>
            <span className="text-sm text-muted">
              or click to choose a file
            </span>
            <span className="mt-1 text-xs text-faint">
              {ACCEPTED_EXTENSIONS.join("  ·  ")}
            </span>
          </>
        )}
      </label>

      {file && !busy ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{file.name}</div>
            <div className="text-xs text-muted">{formatBytes(file.size)}</div>
          </div>
          <button type="button" className="btn btn-sm" onClick={onReset}>
            Choose another
          </button>
        </div>
      ) : null}

      {error ? (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      ) : null}
    </div>
  );
}
