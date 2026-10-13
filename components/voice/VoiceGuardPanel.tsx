"use client";

import { Chip, Notice, Stat } from "@/components/primitives";
import type {
  VoiceCheck,
  VoiceDeviation,
  VoiceDiffRow,
  VoiceProfile,
} from "@/lib/types";
import type { VoiceCheckRow } from "@/lib/voiceChecks";

/**
 * VoiceGuard: the Writing DNA that was measured, and the score that says
 * whether a later pass stayed inside it.
 *
 * The panel shows the profile and the check as two halves of one idea, because
 * the score means nothing without the profile it was measured against. Every
 * number here is computed by the platform from the text; the model only names
 * the tone and the sentence style, and says which passages drifted.
 */

const LABEL_ORDER: [keyof VoiceProfile["labels"], string][] = [
  ["tone", "Tone"],
  ["sentence_style", "Sentence style"],
  ["pov", "Point of view"],
  ["dialogue_frequency", "Dialogue"],
  ["vocabulary_complexity", "Vocabulary"],
  ["emotional_intensity", "Emotional intensity"],
  ["descriptive_depth", "Description"],
];

const SEVERITY_TONE = {
  high: "text-danger",
  medium: "text-warn",
  low: "text-muted",
} as const;

/** One measured value beside the value the candidate text produced. */
function DeviationRow({ deviation }: { deviation: VoiceDeviation }) {
  const expected = formatNumber(deviation.expected);
  const actual = formatNumber(deviation.actual);
  const arrow = deviation.direction === "up" ? "▲" : "▼";

  return (
    <li className="rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{deviation.label}</span>
        <span className={`text-xs font-semibold ${SEVERITY_TONE[deviation.severity]}`}>
          {deviation.severity}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-2 font-mono text-sm tabular-nums">
        <span className="text-muted" title="What your profile measured">
          {expected}
        </span>
        <span aria-hidden className="text-faint">
          {arrow}
        </span>
        <span title="What this text measures">{actual}</span>
        <span className="text-xs text-faint">
          {deviation.unit === "share"
            ? "of lines"
            : deviation.unit === "per 1k"
              ? "per 1000 words"
              : deviation.unit}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">{deviation.note}</p>
    </li>
  );
}

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

function formatNumber(value: number): string {
  return number.format(value);
}

/**
 * The chapter-by-chapter score.
 *
 * A chapter under the backend's floor is listed with its word count and no
 * number, rather than a score computed from too few sentences to mean anything.
 */
function ChapterRow({ row }: { row: VoiceDiffRow }) {
  return (
    <li className="flex items-baseline justify-between gap-3 px-3 py-1.5">
      <span className="min-w-0 truncate text-sm">{row.chapter}</span>
      <span className="shrink-0 font-mono text-xs tabular-nums">
        {row.scored && row.score !== null ? (
          <span className={row.score < 75 ? "text-warn" : "text-muted"}>
            {row.score}%
          </span>
        ) : (
          <span className="text-faint" title={row.note ?? undefined}>
            {number.format(row.word_count)} words
          </span>
        )}
      </span>
    </li>
  );
}

function verdictTone(check: VoiceCheck): "ok" | "warn" | "error" {
  if (check.score === null) return "warn";
  if (check.score < 75) return "error";
  if (check.score < 90) return "warn";
  return "ok";
}

export function VoiceGuardPanel({
  profile,
  check,
  history,
  busy,
  error,
  onGenerateProfile,
  onRunCheck,
  canCheck,
  checkNote,
}: {
  profile: VoiceProfile | null;
  check: VoiceCheck | null;
  history: VoiceCheckRow[];
  busy: boolean;
  error: string | null;
  onGenerateProfile: () => void;
  onRunCheck: () => void;
  /** False when the book has no stored text to check, or no profile yet. */
  canCheck: boolean;
  checkNote: string | null;
}) {
  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-base font-semibold">Writing DNA</h2>
            <p className="mt-0.5 text-sm text-muted">
              Measured from the manuscript, then used as the yardstick every
              later AI pass is held to.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onGenerateProfile}
            disabled={busy}
          >
            {profile ? "Regenerate" : "Measure my voice"}
          </button>
        </header>

        {error ? <Notice tone="error">{error}</Notice> : null}

        {!profile ? (
          <Notice>
            No profile yet. Measuring it costs nothing and reads only your text.
          </Notice>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {LABEL_ORDER.map(([key, label]) => (
                <Chip key={key} title={label}>
                  <span className="text-faint">{label}: </span>
                  {profile.labels[key]}
                </Chip>
              ))}
            </div>

            <p className="text-sm leading-relaxed text-muted">{profile.summary}</p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat
                label="Words read"
                value={number.format(profile.source_word_count)}
              />
              <Stat
                label="Sentence length"
                value={formatNumber(profile.metrics.mean_sentence_length)}
                sub="words, average"
              />
              <Stat
                label="Dialogue"
                value={`${Math.round(profile.metrics.dialogue_ratio * 100)}%`}
                sub="of lines carry speech"
              />
              <Stat
                label="Vocabulary"
                value={formatNumber(profile.metrics.type_token_ratio)}
                sub="distinct-word ratio"
              />
            </div>

            {profile.ai_note ? (
              <Notice tone="warn">{profile.ai_note}</Notice>
            ) : (
              <p className="text-xs text-faint">
                Named by {profile.ai_model ?? "a model"} from the measurements
                and a digest of the book. Cost reported, never charged.
              </p>
            )}

            {profile.exemplars.length > 0 ? (
              <div>
                <span className="label">Lines that carry the voice</span>
                <ul className="space-y-2">
                  {profile.exemplars.map((exemplar) => (
                    <li
                      key={`${exemplar.line_number}-${exemplar.quote.slice(0, 24)}`}
                      className="rounded-lg border border-line bg-surface-2 px-3 py-2"
                    >
                      <p className="font-serif text-sm leading-relaxed">
                        “{exemplar.quote}”
                      </p>
                      <p className="mt-1 text-xs text-faint">
                        Chapter {exemplar.chapter} · line {exemplar.line_number}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="card space-y-3 p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-base font-semibold">
              Voice Preservation Score
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              The stored text measured against the profile above. The score is
              computed from the numbers, so the same text always scores the same.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onRunCheck}
            disabled={busy || !canCheck}
            title={checkNote ?? undefined}
          >
            Run check
          </button>
        </header>

        {!canCheck && checkNote ? <Notice>{checkNote}</Notice> : null}

        {check && !check.available ? (
          <Notice tone="warn">{check.note}</Notice>
        ) : null}

        {check && check.available ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat
                label="Preservation"
                value={`${check.score ?? 0}%`}
                sub={check.verdict ?? undefined}
              />
              <Stat
                label="Profile words"
                value={number.format(check.baseline_word_count)}
              />
              <Stat
                label="Checked words"
                value={number.format(check.candidate_word_count)}
              />
            </div>

            {check.deviations.length === 0 ? (
              <Notice tone="ok">
                Nothing moved outside the bands your profile allows. The voice is
                intact.
              </Notice>
            ) : (
              <div>
                <span className="label">
                  Where it drifted ({check.deviations.length})
                </span>
                <ul className="space-y-2">
                  {check.deviations.map((deviation) => (
                    <DeviationRow key={deviation.metric} deviation={deviation} />
                  ))}
                </ul>
              </div>
            )}

            {check.chapters.length > 0 ? (
              <div>
                <span className="label">Chapter by chapter</span>
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {check.chapters.map((row) => (
                    <ChapterRow key={row.chapter} row={row} />
                  ))}
                </ul>
              </div>
            ) : null}

            {check.examples.length > 0 ? (
              <div>
                <span className="label">
                  Passages that read differently ({check.examples.length})
                </span>
                <ul className="space-y-2">
                  {check.examples.map((example, index) => (
                    <li
                      key={`${example.line_number}-${index}`}
                      className="rounded-lg border border-line bg-surface px-3 py-2.5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-xs font-semibold ${SEVERITY_TONE[example.severity]}`}
                        >
                          {example.severity}
                        </span>
                        <span className="text-xs text-faint">
                          {example.located
                            ? `Chapter ${example.chapter} · line ${example.line_number}`
                            : "Not located in the text"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        {example.message}
                      </p>
                      {example.located ? (
                        <p className="mt-1 font-serif text-sm leading-relaxed">
                          “{example.context}”
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-faint">
                        Advisory only — nothing here is applied automatically.
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {check.ai_note ? <Notice tone="warn">{check.ai_note}</Notice> : null}
          </>
        ) : null}
      </section>

      {history.length > 0 ? (
        <section className="card space-y-3 p-5">
          <header>
            <h2 className="font-serif text-base font-semibold">Check history</h2>
            <p className="mt-0.5 text-sm text-muted">
              Every preservation check run against this book, newest first.
            </p>
          </header>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {history.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-baseline justify-between gap-3 px-3 py-2"
              >
                <span className="text-sm">{row.verdict ?? "checked"}</span>
                <span className="flex items-baseline gap-3 font-mono text-xs tabular-nums">
                  <span
                    className={
                      row.score !== null && row.score < 75
                        ? "text-warn"
                        : "text-muted"
                    }
                  >
                    {row.score === null ? "—" : `${row.score}%`}
                  </span>
                  <span className="text-faint">
                    {new Date(row.created_at).toLocaleString()}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
