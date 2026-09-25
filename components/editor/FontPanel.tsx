"use client";

import { useEffect } from "react";

import {
  GOOGLE_FONTS,
  fontStack,
  loadGoogleFont,
  type GoogleFont,
} from "@/lib/googleFonts";

/**
 * The typography panel: pick a preview face and size for the editor canvas.
 *
 * The families are fetched at runtime rather than declared in `layout.tsx`,
 * because which ones are needed is not known until the author chooses.
 */
export function FontPanel({
  selected,
  onSelect,
  fontSize,
  onFontSizeChange,
  minSize,
  maxSize,
}: {
  selected: GoogleFont;
  onSelect: (font: GoogleFont) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  minSize: number;
  maxSize: number;
}) {
  // The chosen family is fetched as soon as the panel opens, so the canvas is
  // already rendering in it rather than swapping once the stylesheet lands.
  useEffect(() => {
    loadGoogleFont(selected);
  }, [selected]);

  return (
    <aside className="card p-3.5" aria-label="Preview typography">
      <span className="label">Preview font</span>

      <div
        role="radiogroup"
        aria-label="Preview font"
        className="space-y-1.5"
      >
        {GOOGLE_FONTS.map((font) => {
          const isSelected = font.family === selected.family;
          return (
            <button
              key={font.family}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(font)}
              // Fetching on hover and focus keeps every specimen honest without
              // pulling six families down for someone who never opens the panel.
              onMouseEnter={() => loadGoogleFont(font)}
              onFocus={() => loadGoogleFont(font)}
              className={`w-full rounded-xl border p-2.5 text-left transition-colors ${
                isSelected
                  ? "border-accent bg-accent-soft ring-1 ring-accent"
                  : "border-line-strong bg-surface-2 hover:border-accent"
              }`}
            >
              <span className="flex items-baseline justify-between gap-2">
                {/* Twice the canvas size so the differences between the faces
                    are legible at card scale, as GenreSelector does. */}
                <span
                  aria-hidden
                  className="leading-none"
                  style={{ fontFamily: fontStack(font), fontSize: "1.75rem" }}
                >
                  Aa
                </span>
                <span
                  className={`text-[0.65rem] font-semibold tracking-wider uppercase ${
                    isSelected ? "text-accent" : "text-faint"
                  }`}
                >
                  {isSelected ? "Selected" : font.category}
                </span>
              </span>
              <span className="mt-1.5 block text-sm font-medium">
                {font.family}
              </span>
              <span className="block text-xs leading-snug text-muted">
                {font.blurb}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <label className="label" htmlFor="preview-size">
          Preview size
        </label>
        <div className="flex items-center gap-2">
          <input
            id="preview-size"
            type="range"
            min={minSize}
            max={maxSize}
            step={0.5}
            value={fontSize}
            onChange={(event) => onFontSizeChange(Number(event.target.value))}
            className="h-1.5 flex-1 accent-[var(--color-accent)]"
          />
          <span className="w-14 text-right font-mono text-sm tabular-nums">
            {fontSize} pt
          </span>
        </div>
      </div>

      {/*
        Stated plainly because it is the one thing about this panel that is not
        obvious: these families are loaded into the browser, and the export is
        rendered by WeasyPrint on the server, which resolves fonts installed
        there.
      */}
      <p className="mt-3 text-xs leading-relaxed text-muted">
        These faces are fetched into the browser to preview the page. The PDF is
        rendered on the server, which can only use fonts installed there, so a
        preview here does not guarantee the exported file uses it.
      </p>
    </aside>
  );
}
