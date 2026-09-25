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

export interface ExportSettings {
  title: string;
  author: string;
  genre: Genre;
  trimSize: TrimSize;
  customFont: string;
  fontSize: number | null;
}
