"use client";

import Link from "next/link";

import { Chip, Notice, Stat } from "@/components/primitives";
import type {
  BibleEntity,
  BibleEntityKind,
  Contradiction,
  StoryBible,
} from "@/lib/types";

/**
 * The story bible, and the continuity flags it produces.
 *
 * Two sections that belong together but are not the same thing. The bible is
 * what the book contains: who and what, with the chapter and line each detail
 * came from. The contradictions are where those details disagree with each
 * other — computed by rules, not by a model, so a flag is reproducible and can
 * be argued with.
 */

const KIND_ORDER: BibleEntityKind[] = ["character", "location", "prop", "timeline"];

const SEVERITY_TONE = {
  high: "text-danger",
  medium: "text-warn",
  low: "text-muted",
} as const;

function where(chapter: string, lineNumber: number): string {
  return `${chapter} · line ${lineNumber}`;
}

/**
 * One entity and everything the book says about it.
 *
 * The attributes are the point: each one carries the line it came from, so a
 * detail can be checked against the text rather than trusted.
 */
function EntityCard({ entity }: { entity: BibleEntity }) {
  return (
    <li className="rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{entity.name}</span>
        <span className="text-xs text-faint">
          {entity.mention_count} mention{entity.mention_count === 1 ? "" : "s"}
        </span>
        {entity.aliases.map((alias) => (
          <Chip key={alias} title="Also written as">
            {alias}
          </Chip>
        ))}
      </div>

      {entity.attributes.length === 0 ? (
        <p className="mt-1.5 text-xs text-faint">
          No details were recorded for this one.
        </p>
      ) : (
        <dl className="mt-2 space-y-1.5">
          {entity.attributes.map((attribute, index) => (
            <div
              key={`${attribute.field}-${attribute.line_number}-${index}`}
              className="border-l-2 border-line pl-2.5"
            >
              <dt className="text-[0.7rem] font-semibold tracking-wider text-faint uppercase">
                {attribute.field}
                {attribute.comparable ? null : (
                  <span
                    className="ml-1.5 normal-case tracking-normal"
                    title="Recorded, but there is no rule to compare this kind of detail across chapters."
                  >
                    (not compared)
                  </span>
                )}
              </dt>
              <dd className="text-sm">
                {attribute.value}
                <span className="ml-2 text-xs text-faint">
                  {where(attribute.chapter, attribute.line_number)}
                </span>
              </dd>
              {attribute.quote ? (
                <dd className="mt-0.5 font-serif text-sm leading-relaxed text-muted">
                  “{attribute.quote}”
                </dd>
              ) : null}
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}

/**
 * One contradiction, with every competing value.
 *
 * The author is sent to the earliest mention, because that is the one the later
 * statements disagree with — but both sides are shown, along with where they
 * are, because only the author knows which one they meant. Nothing here is
 * auto-fixable and the panel says so.
 */
function ContradictionRow({
  contradiction,
  bookId,
}: {
  contradiction: Contradiction;
  bookId: string | null;
}) {
  return (
    <li className="rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs font-semibold ${SEVERITY_TONE[contradiction.severity]}`}
            >
              {contradiction.severity}
            </span>
            <span className="text-sm font-medium">{contradiction.entity}</span>
            <span className="text-xs text-faint">{contradiction.field}</span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {contradiction.message}
          </p>
        </div>
        {bookId ? (
          <Link
            href={`/dashboard/books/${bookId}#edit`}
            className="btn btn-sm shrink-0"
            title="Open the book at the editor. The line number is given above."
          >
            Open the book
          </Link>
        ) : null}
      </div>

      <ul className="mt-2 space-y-1.5">
        {contradiction.values.map((value) => (
          <li
            key={`${value.line_number}-${value.value}`}
            className="rounded border border-line bg-surface-2 px-2.5 py-1.5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm">{value.value}</span>
              <span className="text-xs text-faint">
                {where(value.chapter, value.line_number)}
              </span>
            </div>
            {value.quote ? (
              <p className="mt-0.5 font-serif text-xs leading-relaxed text-muted">
                “{value.quote}”
              </p>
            ) : null}
            {value.also_at.length > 0 ? (
              <p className="mt-0.5 text-xs text-faint">
                Also at{" "}
                {value.also_at
                  .map((spot) => where(spot.chapter, spot.line_number))
                  .join(", ")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {contradiction.suggestion ? (
        <p className="mt-1.5 text-xs text-faint">{contradiction.suggestion}</p>
      ) : null}
      <p className="mt-1 text-xs text-faint">
        A continuity flag is never applied automatically — which of these is
        right is your decision.
      </p>
    </li>
  );
}

export function StoryBiblePanel({
  bible,
  busy,
  error,
  onGenerate,
  bookId,
  canGenerate,
  note,
}: {
  bible: StoryBible | null;
  busy: boolean;
  error: string | null;
  onGenerate: () => void;
  /** For the flag rows' link back into the editor. */
  bookId: string | null;
  canGenerate: boolean;
  /** Why the pass cannot run, when it cannot. */
  note: string | null;
}) {
  const byKind = KIND_ORDER.map((kind) => ({
    kind,
    label: bible?.entities.find((entity) => entity.kind === kind)?.kind_label ?? kind,
    entities: (bible?.entities ?? []).filter((entity) => entity.kind === kind),
  })).filter((group) => group.entities.length > 0);

  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-base font-semibold">Story bible</h2>
            <p className="mt-0.5 text-sm text-muted">
              Who and what is in the book, with the line each detail came from.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onGenerate}
            disabled={busy || !canGenerate}
            title={note ?? undefined}
          >
            {bible ? "Rebuild" : "Build the bible"}
          </button>
        </header>

        {error ? <Notice tone="error">{error}</Notice> : null}
        {!canGenerate && note ? <Notice>{note}</Notice> : null}

        {!bible ? (
          <Notice>
            Nothing extracted yet. The character list comes from the platform's
            own name detection; the attributes and the timeline need an AI pass.
          </Notice>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat
                label="Characters"
                value={bible.entities.filter((e) => e.kind === "character").length}
              />
              <Stat
                label="Locations"
                value={bible.entities.filter((e) => e.kind === "location").length}
              />
              <Stat
                label="Objects"
                value={bible.entities.filter((e) => e.kind === "prop").length}
              />
              <Stat
                label="Timeline"
                value={bible.entities.filter((e) => e.kind === "timeline").length}
              />
            </div>

            {bible.ai_note ? <Notice tone="warn">{bible.ai_note}</Notice> : null}
          </>
        )}
      </section>

      {bible && bible.contradictions.length > 0 ? (
        <section className="card space-y-3 p-5">
          <header>
            <h2 className="font-serif text-base font-semibold">
              Continuity flags ({bible.contradictions.length})
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              Details two chapters disagree about. Each row names the earliest
              mention and every value that conflicts with it.
            </p>
          </header>
          <ul className="space-y-2">
            {bible.contradictions.map((contradiction) => (
              <ContradictionRow
                key={contradiction.id}
                contradiction={contradiction}
                bookId={bookId}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {byKind.length > 0 ? (
        <section className="card space-y-4 p-5">
          <header>
            <h2 className="font-serif text-base font-semibold">The cast and the places</h2>
            <p className="mt-0.5 text-sm text-muted">
              Grouped by kind. Every detail below is quoted from somewhere in the
              book, so it can be checked rather than taken on trust.
            </p>
          </header>

          {byKind.map((group) => (
            <div key={group.kind}>
              <span className="label">
                {group.label} ({group.entities.length})
              </span>
              <ul className="space-y-2">
                {group.entities.map((entity) => (
                  <EntityCard key={entity.id} entity={entity} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}

      {bible && bible.skipped_fields.length > 0 ? (
        <section className="card space-y-3 p-5">
          <header>
            <h2 className="font-serif text-base font-semibold">
              Details that were not compared
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              These were recorded but no rule covers them, so nothing here is a
              flag. They are listed so the omission is visible.
            </p>
          </header>
          <ul className="space-y-1.5 text-sm text-muted">
            {bible.skipped_fields.map((item, index) => (
              <li key={`${item.entity}-${item.field}-${index}`}>
                <span className="text-ink">
                  {item.entity} · {item.field}
                </span>{" "}
                — {item.reason}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
