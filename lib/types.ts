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

export interface BookAnalysis {
  word_count: number;
  chapter_count: number;
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
