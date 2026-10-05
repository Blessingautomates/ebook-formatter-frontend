"use client";

import Link from "next/link";

import { Notice } from "@/components/primitives";
import { GENRE_OPTIONS, TRIM_OPTIONS } from "@/lib/genres";

/**
 * Publishing Presets.
 *
 * A preset is a named bundle of the settings a book's layout page already
 * holds — genre sheet, trim size and font. They exist so that "paperback
 * novel" or "academic monograph" is one choice instead of four, which is the
 * part of formatting an author is least likely to have an opinion about.
 *
 * Every value below is one the exporter accepts today. That is the whole point
 * of a preset: if it could not be rendered, it would be a suggestion rather
 * than a preset.
 */
interface Preset {
  id: string;
  name: string;
  summary: string;
  genre: string;
  trim: string;
  font: string;
  footnote: string;
}

const PRESETS: Preset[] = [
  {
    id: "trade-paperback",
    name: "Trade Paperback Novel",
    summary: "Justified serif at 11 pt, indented paragraphs, no space between.",
    genre: "fiction",
    trim: "6x9",
    font: "Georgia",
    footnote: "The default for most fiction.",
  },
  {
    id: "digest-novella",
    name: "Digest Novella",
    summary: "The same setting on a smaller page, for a shorter book.",
    genre: "fiction",
    trim: "5.5x8.5",
    font: "Georgia",
    footnote: "Fits more pages per sheet at short lengths.",
  },
  {
    id: "business-nonfiction",
    name: "Business & Non-Fiction",
    summary: "Flush-left paragraphs with airier leading and space between.",
    genre: "non-fiction",
    trim: "6x9",
    font: "Georgia",
    footnote: "Reads well for argument and chaptered advice.",
  },
  {
    id: "academic-monograph",
    name: "Academic Monograph",
    summary: "Times at 10.5 pt with deep first-line indents and ruled tables.",
    genre: "academic",
    trim: "6x9",
    font: "Times New Roman",
    footnote: "For citation-heavy work.",
  },
  {
    id: "journal-article",
    name: "Journal Article",
    summary: "The smallest type here, sized for a dense article page.",
    genre: "journal",
    trim: "6x9",
    font: "Times New Roman",
    footnote: "Meant to be read as a paper, not a book.",
  },
  {
    id: "screenplay",
    name: "Screenplay",
    summary: "Monospaced and unhyphenated, for script and panel text.",
    genre: "comic",
    trim: "6x9",
    font: "Courier New",
    footnote: "Keeps action and dialogue columns aligned.",
  },
  {
    id: "clean-minimal",
    name: "Clean Minimal",
    summary: "Sans-serif, ragged right, no hyphenation.",
    genre: "minimal",
    trim: "6x9",
    font: "Helvetica Neue",
    footnote: "For books where the type should disappear.",
  },
  {
    id: "pocket-a5",
    name: "A5 Paperback",
    summary: "Metric page size, for editions printed outside the US.",
    genre: "fiction",
    trim: "a5",
    font: "Georgia",
    footnote: "148 × 210 mm.",
  },
];

function labelFor(
  options: { id: string; label: string }[],
  id: string,
): string {
  return options.find((option) => option.id === id)?.label ?? id;
}

export default function PresetsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:px-8">
      <header>
        <h1 className="font-serif text-2xl font-semibold">Publishing Presets</h1>
        <p className="mt-1 text-sm text-muted">
          Named bundles of the genre sheet, trim size and font a book&rsquo;s
          layout page asks for separately. Every value is one the exporter
          accepts.
        </p>
      </header>

      {/*
        Said plainly rather than left as a surprise: nothing here applies a
        preset for you yet. The settings exist and the exporter honours them,
        but the one-click application is not wired to the workspace.
      */}
      <Notice tone="info">
        These are reference configurations for now. Set the same values on a
        book&rsquo;s <em>Genre and layout</em> step and the export will match the
        summary exactly.
      </Notice>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRESETS.map((preset) => (
          <li key={preset.id} className="card flex flex-col gap-3 p-4">
            <div>
              <p className="font-medium">{preset.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {preset.summary}
              </p>
            </div>

            <dl className="space-y-1 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Genre sheet</dt>
                <dd>{labelFor(GENRE_OPTIONS, preset.genre)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Trim</dt>
                <dd>{labelFor(TRIM_OPTIONS, preset.trim)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Font</dt>
                <dd className="truncate">{preset.font}</dd>
              </div>
            </dl>

            <p className="mt-auto border-t border-line pt-2 text-[0.7rem] text-muted">
              {preset.footnote}
            </p>
          </li>
        ))}
      </ul>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-muted">
          Apply one to a manuscript on its layout step.
        </p>
        <Link href="/dashboard/books/new" className="btn btn-primary btn-sm">
          Start a book
        </Link>
      </div>
    </div>
  );
}
