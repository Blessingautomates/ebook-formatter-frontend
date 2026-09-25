import { createClient } from "./supabase/client";
import type { ChapterSummary, Genre, TrimSize } from "./types";

/**
 * Data access for saved manuscript projects.
 *
 * A project row holds the manuscript's settings and measurements, plus
 * `content` — the edited text, as Markdown, once the author has saved it from
 * the editor.
 *
 * Storing the text is a deliberate reversal of this table's original design,
 * which held settings only. The editor is what changed the trade: an editing
 * surface whose work is lost on reload is not an editing surface, and the
 * Markdown form is the same text the export already receives, so it is one
 * representation rather than two.
 *
 * `content` stays null for a project saved from the upload flow without the
 * editor ever being opened, which is why the UI still says a manuscript has to
 * be uploaded again in that case.
 */
export interface ManuscriptRecord {
  id: string;
  title: string;
  author: string | null;
  word_count: number;
  chapter_count: number;
  chapters: ChapterSummary[];
  genre: Genre;
  font_family: string | null;
  font_size: number | null;
  trim_size: TrimSize;
  /** The edited manuscript as Markdown, or null if it was never edited here. */
  content: string | null;
  created_at: string;
  updated_at: string;
}

/** What a save writes. `user_id` is filled in by the column's default. */
export type ManuscriptDraft = Omit<
  ManuscriptRecord,
  "id" | "created_at" | "updated_at"
>;

/** Named rather than `select *`, so a column added later cannot leak silently. */
const COLUMNS = [
  "id",
  "title",
  "author",
  "word_count",
  "chapter_count",
  "chapters",
  "genre",
  "font_family",
  "font_size",
  "trim_size",
  "content",
  "created_at",
  "updated_at",
].join(",");

export const RECENT_PROJECT_LIMIT = 12;

/**
 * Supabase reports failures as a value, not by throwing, so every call site
 * would otherwise have to remember to check. Throwing here keeps the failure in
 * the caller's own try/catch, where the UI's error state already lives.
 *
 * The declared `never` return is what lets TypeScript narrow `data` to non-null
 * after the check.
 */
function fail(action: string, message: string): never {
  throw new Error(`Could not ${action}: ${message}`);
}

/** The signed-in user's projects, most recently saved first. */
export async function listManuscripts(
  limit: number = RECENT_PROJECT_LIMIT,
): Promise<ManuscriptRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("manuscripts")
    .select(COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) fail("load your projects", error.message);
  return (data ?? []) as unknown as ManuscriptRecord[];
}

/**
 * Create the draft, or update `id` when one is given.
 *
 * Which row is being written is decided by the caller, because only the caller
 * knows whether the user opened an existing project or started a new one.
 */
export async function saveManuscript(
  draft: ManuscriptDraft,
  id?: string | null,
): Promise<ManuscriptRecord> {
  const supabase = createClient();

  const query = id
    ? supabase.from("manuscripts").update(draft).eq("id", id)
    : supabase.from("manuscripts").insert(draft);

  // `.select()` is what makes the write return the stored row, so the caller
  // gets the server's updated_at rather than guessing it.
  const { data, error } = await query.select(COLUMNS).single();

  if (error) fail("save the project", error.message);
  if (!data) fail("save the project", "the server returned no row");
  return data as unknown as ManuscriptRecord;
}

export async function deleteManuscript(id: string): Promise<void> {
  const supabase = createClient();
  // Row-level security scopes this to the caller's own rows, so there is no
  // need to match on user_id here — a row that is not theirs deletes nothing.
  const { error } = await supabase.from("manuscripts").delete().eq("id", id);

  if (error) fail("delete the project", error.message);
}
