"use client";

import { Notice, Spinner, Stat } from "@/components/primitives";
import type { ManuscriptRecord } from "@/lib/manuscripts";
import { GENRE_OPTIONS } from "@/lib/genres";

const number = new Intl.NumberFormat();

const dateFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function savedOn(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "unknown" : dateFormat.format(date);
}

function genreLabel(genre: string): string {
  return GENRE_OPTIONS.find((option) => option.id === genre)?.label ?? genre;
}

/**
 * The chapter breakdown stored with a project.
 *
 * Capped rather than scrolled: this is a summary of a saved manuscript, and a
 * 90-chapter book would otherwise push the rest of the page off the screen.
 */
const CHAPTERS_SHOWN = 12;

function ChapterBreakdown({ chapters }: { chapters: ManuscriptRecord["chapters"] }) {
  if (chapters.length === 0) {
    return (
      <p className="text-xs text-muted">
        No chapter headings were found when this was saved.
      </p>
    );
  }

  const shown = chapters.slice(0, CHAPTERS_SHOWN);

  return (
    <div>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {shown.map((chapter) => (
          <li
            key={`${chapter.line_number}-${chapter.title}`}
            className="flex items-baseline justify-between gap-3 px-3 py-1.5"
          >
            <span className="min-w-0 truncate text-sm">{chapter.title}</span>
            <span className="shrink-0 font-mono text-xs text-muted tabular-nums">
              {number.format(chapter.word_count)} words
            </span>
          </li>
        ))}
      </ul>
      {chapters.length > shown.length ? (
        <p className="mt-1.5 text-xs text-faint">
          and {chapters.length - shown.length} more.
        </p>
      ) : null}
    </div>
  );
}

export function ProjectsPanel({
  email,
  projects,
  loading,
  loadError,
  activeId,
  onOpen,
  onDelete,
  onSignOut,
  onSave,
  saving,
  canSave,
  saveLabel,
  saveError,
  saveNotice,
}: {
  email: string | null;
  projects: ManuscriptRecord[];
  loading: boolean;
  loadError: string | null;
  activeId: string | null;
  onOpen: (record: ManuscriptRecord) => void;
  onDelete: (record: ManuscriptRecord) => void;
  onSignOut: () => void;
  onSave: () => void;
  saving: boolean;
  canSave: boolean;
  saveLabel: string;
  saveError: string | null;
  saveNotice: string | null;
}) {
  const active = projects.find((project) => project.id === activeId) ?? null;

  return (
    <section className="card p-5 sm:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg leading-tight font-semibold">
            Your projects
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {email ? `Signed in as ${email}` : "Saved manuscripts, newest first."}
          </p>
        </div>
        <button type="button" className="btn btn-sm" onClick={onSignOut}>
          Sign out
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSave}
          disabled={!canSave}
        >
          {saving ? <Spinner /> : null}
          {saveLabel}
        </button>
        {!canSave && !saving ? (
          <span className="text-xs text-muted">
            Analyze a manuscript, or open a saved project, to save.
          </span>
        ) : null}
      </div>

      {saveError ? (
        <Notice tone="error" className="mt-3">
          {saveError}
        </Notice>
      ) : null}
      {saveNotice ? (
        <Notice tone="ok" className="mt-3">
          {saveNotice}
        </Notice>
      ) : null}

      {active ? (
        <div className="mt-5 rounded-xl border border-accent bg-accent-soft p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-serif text-base font-semibold">{active.title}</h3>
            <span className="text-xs text-muted">
              saved {savedOn(active.updated_at)}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Words" value={number.format(active.word_count)} />
            <Stat label="Chapters" value={number.format(active.chapter_count)} />
            <Stat label="Genre" value={genreLabel(active.genre)} />
            <Stat
              label="Type"
              value={active.font_family ?? "Genre default"}
              sub={active.font_size ? `${active.font_size} pt` : "auto size"}
            />
          </div>

          <div className="mt-4">
            <span className="label">Chapter breakdown</span>
            <ChapterBreakdown chapters={active.chapters} />
          </div>

          {/*
            The one thing about a saved project that is not obvious. Which of the
            two paragraphs applies depends on whether the manuscript was ever
            saved from the editor: a project saved through the upload flow alone
            holds settings and measurements, and its row's `content` is null.
          */}
          <p className="mt-4 text-xs leading-relaxed text-muted">
            {active.content
              ? "These settings and the manuscript text are loaded back into the editor. Exporting still needs the original file re-uploaded, because that is what tells the renderer the language and script — your edits are kept when you do."
              : "These settings are loaded into the form. The manuscript itself was never saved from the editor, so upload the file again before exporting."}
          </p>
        </div>
      ) : null}

      <div className="mt-5">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> Loading your projects…
          </p>
        ) : loadError ? (
          <Notice tone="error">{loadError}</Notice>
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing saved yet. Analyze a manuscript and save it to see it here.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {projects.map((project) => {
              const isActive = project.id === activeId;
              return (
                <li
                  key={project.id}
                  className={`flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 ${
                    isActive ? "bg-accent-soft" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {project.title}
                    </div>
                    <div className="text-xs text-muted">
                      {number.format(project.word_count)} words ·{" "}
                      {number.format(project.chapter_count)} chapters ·{" "}
                      {genreLabel(project.genre)} · {savedOn(project.updated_at)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => onOpen(project)}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => onDelete(project)}
                      aria-label={`Delete ${project.title}`}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
