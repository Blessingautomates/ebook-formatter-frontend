"use client";

import Link from "next/link";

import { GENRE_OPTIONS, TRIM_OPTIONS } from "@/lib/genres";

/**
 * Templates & Styles.
 *
 * Both grids are read from `lib/genres.ts`, which mirrors the genre sheets in
 * the backend's templates/css/genres/ and the trim sizes in its TRIM_SIZES.
 * Nothing here is a catalogue of things the exporter cannot produce: the
 * specimen face, the point size and the page proportions are the same values
 * the render uses, so a card previews what selecting it will actually give you.
 */
export default function TemplatesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 lg:px-8">
      <header>
        <h1 className="font-serif text-2xl font-semibold">Templates & Styles</h1>
        <p className="mt-1 text-sm text-muted">
          Nine genre sheets and three trim sizes. Pick one when you set a book&rsquo;s
          layout; the export renders exactly what the specimen shows.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-serif text-lg font-semibold">Genre sheets</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GENRE_OPTIONS.map((genre) => (
            <li key={genre.id} className="card p-4">
              <p
                className="text-base leading-snug font-medium"
                style={{ fontFamily: genre.specimenFont, fontSize: `${genre.specimenPt + 3}px` }}
              >
                Aa Bb Cc
              </p>
              <p className="mt-2 text-sm font-medium">{genre.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {genre.blurb}
              </p>
              <p className="mt-2 text-[0.7rem] text-muted">
                Base size {genre.specimenPt} pt
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-lg font-semibold">Trim sizes</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {TRIM_OPTIONS.map((trim) => (
            <li key={trim.id} className="card flex items-center gap-4 p-4">
              {/* Proportionally scaled, so the three read as different shapes. */}
              <span
                aria-hidden
                className="shrink-0 rounded-sm border border-line-strong bg-surface-2"
                style={{ width: trim.width * 9, height: trim.height * 9 }}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{trim.label}</span>
                <span className="block text-xs text-muted">{trim.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-muted">
          Ready to see one on your own manuscript?
        </p>
        <Link href="/dashboard/books/new" className="btn btn-primary btn-sm">
          Start a book
        </Link>
      </div>
    </div>
  );
}
