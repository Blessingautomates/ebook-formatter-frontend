import type { Genre, TrimSize } from "./types";

export interface GenreOption {
  id: Genre;
  label: string;
  blurb: string;
  /** The genre sheet's own font stack, for the specimen on the card. */
  specimenFont: string;
  /** Its base-font-size in points, copied from the sheet. */
  specimenPt: number;
}

/**
 * Mirrors the genre sheets in the backend's templates/css/genres/. The specimen
 * values are copied from those files, so a card previews the sheet it selects.
 */
export const GENRE_OPTIONS: GenreOption[] = [
  {
    id: "fiction",
    label: "Fiction",
    blurb: "Justified, indented paragraphs with no space between them.",
    specimenFont: 'Georgia, "Times New Roman", serif',
    specimenPt: 11,
  },
  {
    id: "non-fiction",
    label: "Non-Fiction",
    blurb: "Justified, airier leading, paragraphs set flush left.",
    specimenFont: 'Georgia, "Times New Roman", serif',
    specimenPt: 11,
  },
  {
    id: "academic",
    label: "Academic",
    blurb: "Times, deep first-line indents, tight leading, ruled tables.",
    specimenFont: '"Times New Roman", Times, serif',
    specimenPt: 10.5,
  },
  {
    id: "journal",
    label: "Journal",
    blurb: "The smallest type here, sized for a dense article page.",
    specimenFont: '"Times New Roman", Times, serif',
    specimenPt: 10,
  },
  {
    id: "comic",
    label: "Comic",
    blurb: "Monospaced and unhyphenated, for scripts and panel text.",
    specimenFont: '"DejaVu Sans Mono", "Courier New", monospace',
    specimenPt: 10.5,
  },
  {
    id: "minimal",
    label: "Minimal",
    blurb: "Sans-serif, ragged right, no hyphenation.",
    specimenFont: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    specimenPt: 10.5,
  },
  {
    id: "poetry",
    label: "Poetry",
    blurb: "Line breaks preserved, unhyphenated, unjustified.",
    specimenFont: 'Georgia, "Times New Roman", serif',
    specimenPt: 11,
  },
  {
    id: "technical",
    label: "Technical",
    blurb: "Sans-serif body with monospaced code blocks.",
    specimenFont: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    specimenPt: 10,
  },
  {
    id: "children",
    label: "Children's",
    blurb: "The largest type here, wide leading, generous margins.",
    specimenFont: '"Trebuchet MS", Verdana, sans-serif',
    specimenPt: 14,
  },
];

export interface TrimOption {
  id: TrimSize;
  label: string;
  detail: string;
  /** For the proportional preview rectangle. */
  width: number;
  height: number;
}

export const TRIM_OPTIONS: TrimOption[] = [
  { id: "6x9", label: "6 × 9 in", detail: "US trade", width: 6, height: 9 },
  {
    id: "5.5x8.5",
    label: "5.5 × 8.5 in",
    detail: "US digest",
    width: 5.5,
    height: 8.5,
  },
  { id: "a5", label: "A5", detail: "148 × 210 mm", width: 5.827, height: 8.268 },
];
