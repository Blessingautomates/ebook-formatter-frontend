import { createClient } from "./supabase/client";
import type { VoiceDeviation, VoiceDiffRow } from "./types";

/**
 * The history of VoiceGuard checks run against one book.
 *
 * A separate table from the manuscript row, because a check is an event rather
 * than a property of the book: an author wants to see that the score fell after
 * the second editing round, not only what the current number is. The artifacts
 * themselves (the profile and the story bible) live on the manuscript row and
 * are read through lib/manuscripts.ts.
 */
export interface VoiceCheckRow {
  id: string;
  score: number | null;
  verdict: string | null;
  deviations: VoiceDeviation[];
  diff: VoiceDiffRow[];
  ai_available: boolean;
  ai_model: string | null;
  ai_cost_usd: number;
  ai_credits: number;
  created_at: string;
}

/** Named rather than `select *`, so a column added later cannot leak silently. */
const COLUMNS = [
  "id",
  "score",
  "verdict",
  "deviations",
  "diff",
  "ai_available",
  "ai_model",
  "ai_cost_usd",
  "ai_credits",
  "created_at",
].join(",");

export const VOICE_CHECK_HISTORY_LIMIT = 10;

/**
 * The most recent preservation checks for one book, newest first.
 *
 * Returns an empty list rather than throwing when the table does not exist yet:
 * a deployment that has not run the schema update should show "no history",
 * not an error where a score belongs.
 */
export async function listVoiceChecks(
  manuscriptId: string,
  limit: number = VOICE_CHECK_HISTORY_LIMIT,
): Promise<VoiceCheckRow[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("manuscript_voice_checks")
    .select(COLUMNS)
    .eq("manuscript_id", manuscriptId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as unknown as VoiceCheckRow[];
}
