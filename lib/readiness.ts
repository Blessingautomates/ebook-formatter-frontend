import type { ManuscriptRecord } from "./manuscripts";

/**
 * How far along a book is, from signals that actually exist.
 *
 * Deliberately not a random number, and deliberately not a score out of a
 * hundred either: each entry is a step the author has or has not taken, and the
 * card shows both the percentage and which steps are left. A bar that only
 * moved when the book got longer would be decoration.
 *
 * The weights reflect how much of the work each step is, not how important it
 * sounds — the manuscript itself is most of it, a title is a minute's typing.
 */
interface Check {
  id: string;
  label: string;
  weight: number;
  done: boolean;
}

export interface Readiness {
  /** 0–100, rounded. */
  percent: number;
  passed: number;
  total: number;
  /** The labels of the steps not yet done, in the order they should be done. */
  remaining: string[];
}

/** The analyzer's own words-per-page, so a page estimate matches the export's. */
export const WORDS_PER_PAGE = 250;

export function estimatedPages(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / WORDS_PER_PAGE));
}

/**
 * `coverReady` and `approved` are optional because those features read from
 * tables a project may not have yet. Leaving them out means "cannot be assessed
 * here", and an unassessable step is left out of the total rather than counted
 * as failed — a book that scores 100% on everything the dashboard can see
 * should not be shown as 60% because of a check that never ran.
 */
/**
 * The fields readiness is computed from, and only those.
 *
 * Narrowed from the full record so the sign-off modal can score a book it has
 * in pieces — the workspace holds the analysis and the settings in state long
 * before a row exists to save them to — without inventing an id or a timestamp
 * to satisfy a wider type.
 */
export type ReadinessInput = Pick<
  ManuscriptRecord,
  "content" | "chapter_count" | "title" | "author"
>;

export function readinessFor(
  record: ReadinessInput,
  flags: { coverReady?: boolean; approved?: boolean } = {},
): Readiness {
  const checks: Check[] = [
    {
      id: "manuscript",
      label: "Manuscript saved",
      weight: 30,
      done: (record.content?.trim().length ?? 0) > 0,
    },
    {
      id: "chapters",
      label: "Chapters detected",
      weight: 20,
      done: record.chapter_count > 0,
    },
    {
      id: "details",
      label: "Title and author set",
      weight: 10,
      // Both, because both are printed on the title page — "Untitled" by an
      // unnamed author is exactly what the export would produce.
      done:
        record.title.trim().length > 0 &&
        record.title.trim() !== "Untitled" &&
        (record.author?.trim().length ?? 0) > 0,
    },
  ];

  if (flags.coverReady !== undefined) {
    checks.push({
      id: "cover",
      label: "Cover validated",
      weight: 20,
      done: flags.coverReady,
    });
  }

  if (flags.approved !== undefined) {
    checks.push({
      id: "approval",
      label: "Final approval signed",
      weight: 20,
      done: flags.approved,
    });
  }

  const total = checks.reduce((sum, check) => sum + check.weight, 0);
  const earned = checks.reduce(
    (sum, check) => sum + (check.done ? check.weight : 0),
    0,
  );

  return {
    percent: total === 0 ? 0 : Math.round((earned / total) * 100),
    passed: checks.filter((check) => check.done).length,
    total: checks.length,
    remaining: checks.filter((check) => !check.done).map((check) => check.label),
  };
}

/** "en" → "English", for the badge. Falls back to the code itself. */
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  ru: "Russian",
  ar: "Arabic",
  hi: "Hindi",
  sw: "Swahili",
  yo: "Yoruba",
  ig: "Igbo",
  ha: "Hausa",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
};

export function languageLabel(code: string | null): string | null {
  if (!code) return null;
  // The analyzer returns a bare code, but a region-tagged one ("en-GB") should
  // still resolve to its language.
  const base = code.toLowerCase().split(/[-_]/)[0];
  return LANGUAGE_NAMES[base] ?? code.toUpperCase();
}
