import type { TypoLocation } from "./types";

/**
 * A row is either fixed to a specific replacement -- the caller can pick any of
 * the backend's suggestions, not just the first -- or ignored. A row with no
 * entry has not been decided either way and is left untouched.
 */
export type Decision =
  | { action: "fix"; replacement: string }
  | { action: "ignore" };

/** Keyed by row key. */
export type Decisions = Record<string, Decision>;

export interface TypoRow extends TypoLocation {
  key: string;
}

/**
 * The backend emits one entry per occurrence, so a word misspelled twice on one
 * line arrives as two entries. Rows collapse those into one, so a single toggle
 * covers the line, and applying a fix replaces every occurrence on it.
 */
export function typoKey(typo: TypoLocation): string {
  return `${typo.line_number}|${typo.word.toLowerCase()}`;
}

export function buildRows(typos: TypoLocation[]): TypoRow[] {
  const rows = new Map<string, TypoRow>();
  for (const typo of typos) {
    const key = typoKey(typo);
    if (!rows.has(key)) rows.set(key, { ...typo, key });
  }
  return [...rows.values()];
}

const TOKEN_RE = /[^\s]+/gu;
// Leading and trailing punctuation, so "teh," and a quoted "teh" still match the
// bare word. \p{L} keeps this correct for non-Latin scripts.
const CORE_RE = /^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}]*)$/u;

/** Carry the manuscript's capitalisation onto the suggestion. */
export function matchCase(replacement: string, original: string): string {
  const letters = original.replace(/[^\p{L}]/gu, "");
  if (!letters) return replacement;
  if (letters.length > 1 && letters === letters.toUpperCase()) {
    return replacement.toUpperCase();
  }
  if (letters[0] === letters[0].toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export interface FixResult {
  text: string;
  /** Replacements made, which can exceed the rows fixed if a word repeats. */
  applied: number;
}

/**
 * Apply the accepted corrections, editing only the recorded line so a word that
 * also occurs elsewhere is left alone. Line numbers come from the same
 * extraction the backend analysed, and a replacement never adds or removes a
 * line, so the numbering stays valid.
 */
export function applyFixes(
  text: string,
  rows: TypoRow[],
  decisions: Decisions,
): FixResult {
  const byLine = new Map<number, Map<string, string>>();

  for (const row of rows) {
    const decision = decisions[row.key];
    if (decision?.action !== "fix") continue;
    const replacement = decision.replacement || row.suggestions[0];
    if (!replacement) continue; // nothing to apply
    const line = byLine.get(row.line_number) ?? new Map<string, string>();
    line.set(row.word.toLowerCase(), replacement);
    byLine.set(row.line_number, line);
  }

  if (byLine.size === 0) return { text, applied: 0 };

  let applied = 0;
  const lines = text.split("\n");

  for (const [lineNumber, replacements] of byLine) {
    const index = lineNumber - 1; // the backend's lines are 1-based
    const original = lines[index];
    if (original === undefined) continue;

    lines[index] = original.replace(TOKEN_RE, (token) => {
      const parts = CORE_RE.exec(token);
      if (!parts) return token;
      const [, leading, core, trailing] = parts;
      const replacement = replacements.get(core.toLowerCase());
      if (!replacement) return token;
      applied += 1;
      return leading + matchCase(replacement, core) + trailing;
    });
  }

  return { text: lines.join("\n"), applied };
}

export function countDecisions(
  rows: TypoRow[],
  decisions: Decisions,
): { fixed: number; ignored: number; pending: number } {
  let fixed = 0;
  let ignored = 0;
  for (const row of rows) {
    const action = decisions[row.key]?.action;
    if (action === "fix") fixed += 1;
    else if (action === "ignore") ignored += 1;
  }
  return { fixed, ignored, pending: rows.length - fixed - ignored };
}
