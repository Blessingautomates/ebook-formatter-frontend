"use client";

import Link from "next/link";

import { Chip } from "@/components/primitives";
import type { ManuscriptRecord } from "@/lib/manuscripts";

/**
 * A one-glance summary of what the intelligence passes have stored on a book,
 * sitting under the five numbered steps.
 *
 * It is deliberately a *summary* rather than a sixth step: the profile and the
 * bible are things you consult while writing, not stages in the upload → export
 * order, and the pass that produces them takes minutes. The link carries the
 * book id so the full view opens on this book rather than on the picker.
 *
 * Everything here is read from the record the workspace already loaded, so this
 * costs no request. A profile written by a background worker *after* the record
 * was fetched will not appear until the record is reloaded — the card says so
 * rather than pretending to be live.
 */
export function WorkspaceIntelligenceCard({
  record,
  bookId,
}: {
  record: ManuscriptRecord | null;
  bookId: string | null;
}) {
  if (!bookId) return null;

  const profile = record?.voice_profile ?? null;
  const bible = record?.story_bible ?? null;
  const href = `/dashboard/intelligence?book=${bookId}`;

  const counts = bible
    ? {
        character: bible.entities.filter((e) => e.kind === "character").length,
        location: bible.entities.filter((e) => e.kind === "location").length,
        prop: bible.entities.filter((e) => e.kind === "prop").length,
        flags: bible.contradictions.length,
      }
    : null;

  return (
    <section className="card px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold">
            Manuscript intelligence
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Your writing voice, the cast and places in the book, and anything two
            chapters disagree about.
          </p>
        </div>
        <Link className="btn btn-sm" href={href}>
          Open Manuscript Intelligence
        </Link>
      </div>

      {!profile && !bible ? (
        <p className="mt-3 text-sm text-muted">
          Nothing generated for this book yet. Open Manuscript Intelligence to
          measure your voice or build the story bible.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {profile ? (
            <div>
              <div className="label">Writing DNA</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Chip title="Tone">{profile.labels.tone}</Chip>
                <Chip title="Sentence style">
                  {profile.labels.sentence_style}
                </Chip>
                <Chip title="Point of view">{profile.labels.pov}</Chip>
                <Chip title="Dialogue frequency">
                  {profile.labels.dialogue_frequency} dialogue
                </Chip>
                <Chip title="Vocabulary complexity">
                  {profile.labels.vocabulary_complexity} vocabulary
                </Chip>
              </div>
              <p className="mt-1.5 text-xs text-faint">
                Measured {new Date(profile.generated_at).toLocaleString()} over{" "}
                {profile.source_word_count.toLocaleString()} words
                {profile.label_source === "measured"
                  ? " · numbers only, no model pass"
                  : ""}
                .
              </p>
            </div>
          ) : null}

          {bible && counts ? (
            <div>
              <div className="label">Story bible</div>
              <p className="mt-1.5 text-sm text-muted">
                {counts.character} character
                {counts.character === 1 ? "" : "s"} · {counts.location} location
                {counts.location === 1 ? "" : "s"} · {counts.prop} object
                {counts.prop === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-xs text-faint">
                {counts.flags === 0
                  ? "No contradictions found between chapters."
                  : `${counts.flags} possible contradiction${
                      counts.flags === 1 ? "" : "s"
                    } to review — each carries the chapters and lines it came from.`}
              </p>
            </div>
          ) : null}

          <p className="text-xs text-faint">
            A pass that finished after this page loaded will not show here until
            you reload.
          </p>
        </div>
      )}
    </section>
  );
}
