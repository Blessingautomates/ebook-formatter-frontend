import { createClient } from "./supabase/client";
import type { ChapterSummary, Genre, TrimSize } from "./types";

/**
 * Data access for saved manuscript projects.
 *
 * A project row is the *settings and measurements* of a manuscript, not the
 * manuscript itself. The text is deliberately not stored: it is the author's
 * work, it is by far the biggest thing here, and nothing on the projects list
 * needs it. The consequence is visible in the UI — reopening a project restores
 * its genre, title and typography, but the file has to be uploaded again before
 * it can be exported.
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
