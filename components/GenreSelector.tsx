"use client";

import { GENRE_OPTIONS } from "@/lib/genres";
import type { Genre } from "@/lib/types";

export function GenreSelector({
  value,
  onChange,
}: {
  value: Genre;
  onChange: (genre: Genre) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Genre"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {GENRE_OPTIONS.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.id)}
            className={`rounded-xl border p-3.5 text-left transition-colors ${
              selected
                ? "border-accent bg-accent-soft ring-1 ring-accent"
                : "border-line-strong bg-surface-2 hover:border-accent"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              {/* Shown at twice the real point size so the differences between
                  genres are legible at card scale; the caption carries the
                  true value. */}
              <span
                aria-hidden
                className="leading-none"
                style={{
                  fontFamily: option.specimenFont,
                  fontSize: `${option.specimenPt * 2}pt`,
                }}
              >
                Aa
              </span>
              <span
                className={`text-[0.7rem] font-semibold tracking-wider uppercase ${
                  selected ? "text-accent" : "text-faint"
                }`}
              >
                {selected ? "Selected" : `${option.specimenPt} pt`}
              </span>
            </div>
            <div className="mt-3 font-serif text-base font-semibold">
              {option.label}
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              {option.blurb}
            </p>
          </button>
        );
      })}
    </div>
  );
}
