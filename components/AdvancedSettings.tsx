"use client";

import { useState } from "react";
import { FONT_GROUPS, MAX_FONT_SIZE, MIN_FONT_SIZE } from "@/lib/fonts";
import { TRIM_OPTIONS } from "@/lib/genres";
import type { ExportSettings } from "@/lib/types";
import { Notice } from "./primitives";

const CUSTOM = "__custom__";

function FontPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (font: string) => void;
}) {
  const known = FONT_GROUPS.some((group) => group.fonts.includes(value));
  // An unrecognised value means the field holds a typed family, so the picker
  // shows Custom and the text input stays visible.
  const [custom, setCustom] = useState(() => Boolean(value) && !known);

  return (
    <div>
      <label className="label" htmlFor="font-family">
        Font family
      </label>
      <select
        id="font-family"
        className="field"
        value={custom ? CUSTOM : value}
        onChange={(event) => {
          const next = event.target.value;
          if (next === CUSTOM) {
            setCustom(true);
            onChange("");
          } else {
            setCustom(false);
            onChange(next);
          }
        }}
      >
        <option value="">Genre default</option>
        {FONT_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.fonts.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={CUSTOM}>Custom family…</option>
      </select>

      {custom ? (
        <input
          type="text"
          className="field mt-2"
          placeholder="e.g. Spectral"
          value={value}
          maxLength={64}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
    </div>
  );
}

export function AdvancedSettings({
  settings,
  onChange,
}: {
  settings: ExportSettings;
  onChange: (patch: Partial<ExportSettings>) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-line bg-surface-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
      >
        <span className="text-sm font-medium">Advanced settings</span>
        <span
          aria-hidden
          className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open ? (
        <div className="space-y-5 border-t border-line px-3.5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="book-title">
                Title
              </label>
              <input
                id="book-title"
                type="text"
                className="field"
                value={settings.title}
                maxLength={200}
                onChange={(event) => onChange({ title: event.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="book-author">
                Author <span className="normal-case">(optional)</span>
              </label>
              <input
                id="book-author"
                type="text"
                className="field"
                value={settings.author}
                maxLength={200}
                onChange={(event) => onChange({ author: event.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FontPicker
              value={settings.customFont}
              onChange={(customFont) => onChange({ customFont })}
            />

            <div>
              <label className="label" htmlFor="font-size">
                Font size
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="font-size"
                  type="range"
                  min={MIN_FONT_SIZE}
                  max={MAX_FONT_SIZE}
                  step={0.5}
                  value={settings.fontSize ?? 11}
                  onChange={(event) =>
                    onChange({ fontSize: Number(event.target.value) })
                  }
                  className="h-1.5 flex-1 accent-[var(--color-accent)]"
                />
                <span className="w-14 text-right font-mono text-sm tabular-nums">
                  {settings.fontSize ? `${settings.fontSize} pt` : "auto"}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-sm mt-2"
                disabled={settings.fontSize === null}
                onClick={() => onChange({ fontSize: null })}
              >
                Use the genre default
              </button>
            </div>
          </div>

          <Notice>
            The font has to be installed on the <em>server</em>: the PDF is
            rendered there, so the browser&rsquo;s own fonts are not available
            to it. An unavailable family falls back to the genre&rsquo;s stack.
          </Notice>

          <div>
            <span className="label">Trim size</span>
            <div
              role="radiogroup"
              aria-label="Trim size"
              className="grid gap-2 sm:grid-cols-3"
            >
              {TRIM_OPTIONS.map((option) => {
                const selected = option.id === settings.trimSize;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onChange({ trimSize: option.id })}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? "border-accent bg-accent-soft"
                        : "border-line bg-surface hover:border-line-strong"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`h-10 shrink-0 rounded-[2px] border ${
                        selected
                          ? "border-accent bg-surface"
                          : "border-line-strong bg-surface-2"
                      }`}
                      style={{ aspectRatio: `${option.width} / ${option.height}` }}
                    />
                    <span>
                      <span className="block text-sm font-medium">
                        {option.label}
                      </span>
                      <span className="block text-xs text-muted">
                        {option.detail}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-faint">
              Trim applies to the paged formats. EPUB reflows to the reader, so
              it has no fixed page.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
