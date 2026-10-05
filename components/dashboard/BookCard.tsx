"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { MoreIcon, TrashIcon } from "@/components/shell/icons";
import { GENRE_OPTIONS } from "@/lib/genres";
import type { ManuscriptRecord } from "@/lib/manuscripts";
import {
  estimatedPages,
  languageLabel,
  readinessFor,
  type Readiness,
} from "@/lib/readiness";

const NUMBER = new Intl.NumberFormat("en-US");

function genreLabel(id: string): string {
  return GENRE_OPTIONS.find((option) => option.id === id)?.label ?? id;
}

function genreSpecimenFont(id: string): string {
  return GENRE_OPTIONS.find((option) => option.id === id)?.specimenFont ?? "inherit";
}

/**
 * How full the readiness bar is, by tone.
 *
 * The bar and the number always agree: both read `readiness.percent`. What the
 * colour adds is which step to look at next — a book at 30% needs its
 * manuscript, one at 80% needs its cover.
 */
function barTone(percent: number): string {
  if (percent >= 80) return "bg-ok";
  if (percent >= 40) return "bg-accent";
  return "bg-warn";
}

/**
 * One book in the grid.
 *
 * The cover is drawn rather than loaded: nothing stores a cover image yet, and
 * a stock thumbnail would be a picture of a book that is not this book. What is
 * shown instead is the real title and author set in the genre's own specimen
 * face — which is the same face the export will use — so it previews the
 * typography honestly while standing in for artwork that does not exist.
 */
export function BookCard({
  record,
  readiness,
  onDelete,
}: {
  record: ManuscriptRecord;
  readiness?: Readiness;
  onDelete?: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBox = useRef<HTMLDivElement>(null);

  const state = readiness ?? readinessFor(record);
  const href = `/dashboard/books/${record.id}`;
  const language = languageLabel(record.language);
  const pages = estimatedPages(record.word_count);

  useEffect(() => {
    if (!menuOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (!menuBox.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <article className="card group flex flex-col overflow-hidden">
      <Link href={href} className="block focus-visible:outline-offset-2">
        <div className="relative aspect-[3/2] overflow-hidden bg-gradient-to-br from-surface-2 via-surface to-paper">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-accent to-accent-strong" />
          <div className="flex h-full flex-col justify-center px-5 py-4">
            <p
              className="line-clamp-3 font-serif text-lg leading-snug font-semibold"
              style={{ fontFamily: genreSpecimenFont(record.genre) }}
            >
              {record.title.trim() || "Untitled"}
            </p>
            {record.author ? (
              <p className="mt-1.5 truncate text-xs text-muted">{record.author}</p>
            ) : null}
          </div>

          {language ? (
            <span className="absolute top-3 right-3 rounded-full border border-line bg-surface/90 px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted uppercase">
              {language}
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <Link
            href={href}
            className="block truncate font-medium hover:text-accent"
          >
            {record.title.trim() || "Untitled"}
          </Link>
          <p className="mt-0.5 text-xs text-muted">{genreLabel(record.genre)}</p>
        </div>

        <p className="text-xs text-muted">
          {NUMBER.format(record.word_count)} words ·{" "}
          {NUMBER.format(record.chapter_count)}{" "}
          {record.chapter_count === 1 ? "chapter" : "chapters"} ·{" "}
          {NUMBER.format(pages)} {pages === 1 ? "page" : "pages"}
        </p>

        <div className="mt-auto space-y-1.5">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium">{state.percent}% ready</span>
            <span className="text-muted">
              {state.passed}/{state.total} checks
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={state.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${record.title || "Untitled"} readiness`}
            className="h-1.5 overflow-hidden rounded-full bg-surface-2"
          >
            <div
              className={`h-full rounded-full transition-[width] ${barTone(state.percent)}`}
              style={{ width: `${state.percent}%` }}
            />
          </div>
          {state.remaining.length > 0 ? (
            <p className="truncate text-[0.7rem] text-muted">
              Next: {state.remaining[0]}
            </p>
          ) : (
            <p className="text-[0.7rem] text-ok">Ready to publish</p>
          )}
        </div>

        <div className="flex items-center gap-1 border-t border-line pt-3">
          {/*
            These land on the step they name via the anchors in BookWorkspace,
            which is why they are links rather than buttons — they are
            navigation, and should be openable in a new tab like any other.
          */}
          <Link href={`${href}#edit`} className="btn btn-sm flex-1">
            Edit
          </Link>
          <Link href={`${href}#layout`} className="btn btn-sm flex-1">
            Format
          </Link>
          <Link href={`${href}#export`} className="btn btn-sm flex-1">
            Export
          </Link>

          <div ref={menuBox} className="relative">
            <button
              type="button"
              aria-label={`More actions for ${record.title || "Untitled"}`}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((open) => !open)}
              className="btn btn-sm px-2"
            >
              <MoreIcon className="size-4" />
            </button>

            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-30 mt-1.5 w-44 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg"
              >
                <Link
                  href={`${href}#prescan`}
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-sm hover:bg-surface-2"
                >
                  Analyze
                </Link>
                <Link
                  href={href}
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-sm hover:bg-surface-2"
                >
                  Open book
                </Link>
                {onDelete ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(record.id);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-surface-2"
                  >
                    <TrashIcon className="size-4" />
                    Delete
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
