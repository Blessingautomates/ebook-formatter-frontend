/** Shapes mirroring the FastAPI response models in the backend's main.py. */

export type ScriptType =
  | "latin"
  | "rtl"
  | "cjk"
  | "cyrillic"
  | "greek"
  | "devanagari";

export type TextDirection = "ltr" | "rtl";

export type Genre =
  | "fiction"
  | "non-fiction"
  | "academic"
  | "journal"
  | "comic"
  | "minimal"
  | "poetry"
  | "technical"
  | "children";

export type ExportFormat = "pdf" | "epub" | "docx" | "rtf" | "txt";

export type TrimSize = "6x9" | "5.5x8.5" | "a5";

export interface TypoLocation {
  word: string;
  suggestions: string[];
  /** Chapter title, or "Front Matter". */
  chapter: string;
  /** 1-based line in the *extracted* text, which is not always the line in the
   * original .docx. */
  line_number: number;
  context: string;
  likely_proper_noun: boolean;
}

export interface ChapterSummary {
  /** The heading, without its Markdown marker. */
  title: string;
  /** The line the heading is on, 1-based. */
  line_number: number;
  /** Words in the chapter, its heading included. */
  word_count: number;
}

export interface BookAnalysis {
  word_count: number;
  chapter_count: number;
  /**
   * Per-chapter breakdown, in document order. A "Front Matter" entry appears
   * when the manuscript has text before its first heading, so this can be one
   * longer than chapter_count.
   */
  chapters: ChapterSummary[];
  detected_language: string;
  language_name: string;
  text_direction: TextDirection;
  script_type: ScriptType;
  estimated_pages: number;
  token_cost: number;
  typo_count: number;
  typos: TypoLocation[];
  typo_check_available: boolean;
  typo_check_note: string | null;
  /** Present only because we ask for it with include_text. */
  manuscript_text?: string | null;
}

/** A finding's provenance. A rule finding is exact, reproducible and free; an
 * AI finding is a judgement. They deserve different amounts of trust, so the
 * dashboard says which is which rather than blending them into one count. */
export type FindingSource = "rules" | "ai";

export type FindingSeverity = "high" | "medium" | "low";

/** The Book Doctor section a category is filed under. */
export type FindingGroup =
  | "Writing health"
  | "Consistency"
  | "Dialogue"
  | "Pacing"
  | "Typography & structure";

export interface HealthFinding {
  /** Stable across re-runs of the same manuscript, so a finding the author has
   * already reviewed or dismissed is not raised a second time. */
  id: string;
  category: string;
  severity: FindingSeverity;
  message: string;
  /** Chapter title, or "Front Matter". */
  chapter: string;
  /** 1-based line in the *extracted* text, which is not always the line in the
   * original .docx. */
  line_number: number;
  context: string;
  suggestion: string | null;
  /** The exact text to replace. Null for anything that is a judgement call
   * rather than a mechanical fix. */
  original: string | null;
  replacement: string | null;
  /** Whether [Fix All] may apply this automatically. True only when `original`
   * and `replacement` are both set — prose judgement never qualifies. */
  fixable: boolean;
}

export interface HealthCategory {
  id: string;
  label: string;
  group: FindingGroup;
  source: FindingSource;
  /** Whether [Fix All] may apply findings in this category. */
  fixable: boolean;
  count: number;
  /**
   * False when the category could not be checked at all — no dictionary for the
   * language, or no API key. That is a different thing from `count === 0`,
   * which means it *was* checked and came back clean, and the two must not be
   * rendered the same way.
   */
  available: boolean;
  note: string | null;
  findings: HealthFinding[];
}

export interface HealthReadingLevel {
  /** Flesch Reading Ease. Higher is easier; 60-70 is plain English. */
  flesch_reading_ease: number;
  /** US school grade the manuscript reads at. */
  flesch_kincaid_grade: number;
  /** The grade in plain language. */
  label: string;
}

export interface HealthMetrics {
  word_count: number;
  character_count: number;
  character_count_no_spaces: number;
  sentence_count: number;
  paragraph_count: number;
  /** Excludes the Front Matter entry, so this can be one less than the entry
   * count in a pre-scan's `chapters`. */
  chapter_count: number;
  /** Estimated typeset pages, from the same words-per-page figure the pre-scan
   * and the exporter use, so the three cannot disagree. */
  print_pages: number;
  /** At 220 words per minute. */
  reading_time_minutes: number;
  /** Null when the manuscript is not in English, in which case
   * `reading_level_note` says why. Flesch-Kincaid is a formula over English
   * syllables and would return a meaningless number in another language. */
  reading_level: HealthReadingLevel | null;
  reading_level_note: string | null;
  /** Offered as a default for the genre selector, not as a verdict. */
  detected_genre: Genre;
  /** 0-1. Low means the signals were close together or absent. */
  genre_confidence: number;
  genre_source: "heuristic" | "ai" | "default";
  /**
   * 0-100, from structural signals only.
   *
   * **Not** `readinessFor` in lib/readiness.ts, which scores saved-row state
   * (title set, cover validated, sign-off signed). Those are two different
   * numbers and must never be shown as one.
   */
  completeness: number;
  /** What is missing, one line each. Empty at 100. */
  completeness_notes: string[];
  /** How long a scan of this manuscript takes. */
  estimated_processing_seconds: number;
}

export interface HealthReport {
  metrics: HealthMetrics;
  /** Every category, whether or not it found anything, so the breakdown renders
   * a stable set of rows. */
  categories: HealthCategory[];
  total_findings: number;
  /** How many [Fix All] would apply. */
  fixable_findings: number;
  /** 0-100, from defect *density* rather than defect count: a long novel with
   * thirty findings is in better shape than a short story with thirty. */
  health_score: number;
  ai_available: boolean;
  ai_note: string | null;
  ai_model: string | null;
  ai_calls: number;
  /** What the AI pass actually cost, computed from the token usage the API
   * reported. This is a real cost, and a different quantity from the pre-scan's
   * `token_cost`, which is a platform pricing formula. Never summed with it. */
  ai_cost_usd: number;
  /** `ai_cost_usd` in platform credits. Reported, not charged. */
  ai_credits: number;
  scanned_at: string;
}

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "stale";

/** The response to starting a scan. Poll the job for the report. */
export interface HealthJobAccepted {
  job_id: string;
  status: JobStatus;
}

export interface HealthJobStatus {
  job_id: string;
  /**
   * "stale" means the scan stopped before finishing — the background runner is
   * in-process and does not survive a server restart, so an orphaned job reads
   * as stale rather than spinning forever. Start it again.
   */
  status: JobStatus;
  /** queued, extracting, metrics, rules, ai, assembling, done. */
  stage: string | null;
  /** 0-100. */
  progress: number;
  source_filename: string | null;
  error: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** Present once `status` is "succeeded". */
  report: HealthReport | null;
  /**
   * Which pass this job is. One poll route serves all four kinds, so a caller
   * reads `kind` before it knows which field carries the result.
   */
  kind: JobKind;
  /** The result of a non-health job. A health scan unpacks into `report`. */
  payload: Record<string, unknown> | null;
}

export type JobKind = "health" | "voice" | "bible" | "voice_check";

/* -------------------------------------------------------------------------- */
/* VoiceGuard — the Writing DNA profile and the preservation check             */
/* -------------------------------------------------------------------------- */

/**
 * The numbers behind a profile. All of them are measured from the text rather
 * than asked of a model, so two runs over the same manuscript agree.
 *
 * Every field is a *proxy* for something a reader would name by feeling.
 * `descriptive_depth` counts simile markers and adverbs per 1000 words, which
 * is not "how descriptive is this, really". The proxies are stable and
 * comparable, which is what the preservation check needs; they are not a
 * verdict on the prose.
 */
export interface StyleMetrics {
  word_count: number;
  sentence_count: number;
  mean_sentence_length: number;
  /** Coefficient of variation, so a chapter can be compared with a book. */
  sentence_length_variation: number;
  short_sentence_ratio: number;
  long_sentence_ratio: number;
  dialogue_ratio: number;
  type_token_ratio: number;
  long_word_ratio: number;
  mean_word_length: number;
  first_person_rate: number;
  second_person_rate: number;
  third_person_rate: number;
  pov: string;
  emotion_rate: number;
  exclamation_rate: number;
  question_rate: number;
  descriptive_depth: number;
  simile_rate: number;
}

/** The seven labels the author actually reads. */
export interface VoiceLabels {
  tone: string;
  sentence_style: string;
  pov: string;
  dialogue_frequency: string;
  vocabulary_complexity: string;
  emotional_intensity: string;
  descriptive_depth: string;
}

export interface VoiceProfile {
  version: number;
  generated_at: string;
  metrics: StyleMetrics;
  labels: VoiceLabels;
  /** "measured" when the AI half did not run, "measured+ai" when it did. */
  label_source: string;
  summary: string;
  /** Quotes the profile was built from, each with a real line number. */
  exemplars: { quote: string; chapter: number; line_number: number }[];
  source_word_count: number;
  ai_available: boolean;
  ai_note: string | null;
  ai_model: string | null;
  ai_cost_usd: number;
  ai_credits: number;
}

export type DeviationSeverity = "high" | "medium" | "low";

/**
 * One metric that moved outside the profile's tolerance band.
 *
 * `expected` is the profile's own value and `actual` the candidate's, so the
 * panel can draw the two side by side rather than describe the gap in prose.
 */
export interface VoiceDeviation {
  metric: string;
  label: string;
  severity: DeviationSeverity;
  expected: number;
  actual: number;
  /** How far the metric may move before it counts as a deviation at all. */
  tolerance: number;
  direction: "up" | "down";
  note: string;
  unit: string;
}

/** One chapter's own score, so a drift can be traced to where it lives. */
export interface VoiceDiffRow {
  /** The chapter title, e.g. "Chapter 3", or "Front Matter". */
  chapter: string;
  /** False when the chapter is too short for its own numbers to mean anything. */
  scored: boolean;
  score: number | null;
  word_count: number;
  note: string | null;
  deviations: VoiceDeviation[];
}

export interface VoiceCheck {
  available: boolean;
  /** Why the check could not run, when `available` is false. */
  note: string | null;
  score: number | null;
  verdict: string | null;
  baseline_word_count: number;
  candidate_word_count: number;
  metrics: StyleMetrics;
  baseline_metrics: StyleMetrics;
  deviations: VoiceDeviation[];
  chapters: VoiceDiffRow[];
  checked_at: string;
  /** Passages a model judged to have drifted. Advisory; never moves `score`. */
  examples: VoiceExample[];
  ai_available: boolean;
  ai_note: string | null;
  ai_model: string | null;
  ai_cost_usd: number;
  ai_credits: number;
}

/**
 * One passage the model says no longer sounds like the author.
 *
 * `located` is the honest part: the quote is searched for in the manuscript, and
 * when it is not found verbatim the row says so and carries no line number,
 * rather than sending the author to a line the model made up.
 */
export interface VoiceExample {
  severity: DeviationSeverity;
  message: string;
  chapter: number;
  line_number: number;
  context: string;
  located: boolean;
  quote: string;
}

/* -------------------------------------------------------------------------- */
/* Continuity Checker — the story bible and its contradictions                 */
/* -------------------------------------------------------------------------- */

export interface BibleAttribute {
  field: string;
  value: string;
  /** The chapter title, e.g. "Chapter 3", or "Front Matter". */
  chapter: string;
  line_number: number;
  quote: string;
  /** "rules" when the deterministic pass found it, "ai" when the model did. */
  source: string;
  /**
   * False for a field the detector recorded but has no rule to compare — a
   * free-text field like "occupation". Those are listed but never flagged.
   */
  comparable: boolean;
}

export interface BibleEntity {
  id: string;
  kind: BibleEntityKind;
  /** The kind as the backend spells it for display, e.g. "Character". */
  kind_label: string;
  name: string;
  aliases: string[];
  mention_count: number;
  chapters: number[];
  attributes: BibleAttribute[];
  source: string;
}

/**
 * One detail two chapters disagree about. Deliberately mirrors `HealthFinding`
 * field for field so a single row component renders both kinds of flag.
 *
 * Never auto-fixable: only the author knows which of the competing values is
 * the one they meant.
 */
export interface Contradiction {
  id: string;
  category: "continuity";
  kind: string;
  entity: string;
  entity_id: string;
  field: string;
  severity: FindingSeverity;
  message: string;
  /** The chapter title, e.g. "Chapter 3", or "Front Matter". */
  chapter: string;
  line_number: number;
  context: string;
  suggestion: string | null;
  original: null;
  replacement: null;
  fixable: false;
  /** Every competing value, each with the chapter and line it came from. */
  values: {
    value: string;
    chapter: string;
    line_number: number;
    quote: string;
    /** Other places the same value appears, beyond the first mention. */
    also_at: { chapter: string; line_number: number }[];
  }[];
}

export type BibleEntityKind = "character" | "location" | "prop" | "timeline";

export interface StoryBible {
  generated_at: string;
  entities: BibleEntity[];
  contradictions: Contradiction[];
  /** Fields the detector recorded but could not compare, and why. */
  skipped_fields: { entity: string; field: string; reason: string }[];
  ai_available: boolean;
  ai_note: string | null;
  ai_model: string | null;
  ai_calls: number;
  ai_cost_usd: number;
  ai_credits: number;
}

export interface ExportSettings {
  title: string;
  author: string;
  genre: Genre;
  trimSize: TrimSize;
  customFont: string;
  fontSize: number | null;
}
