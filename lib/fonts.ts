/**
 * A curated list for the font picker. The exporter strips a font name down to
 * letters, digits, spaces and hyphens before it reaches the CSS, so anything
 * typed here has to survive that. WeasyPrint resolves the family on the server,
 * which means a font only renders if it is installed there -- hence the note in
 * the settings panel and the "leave blank for the genre default" option.
 */
export interface FontGroup {
  label: string;
  fonts: string[];
}

export const FONT_GROUPS: FontGroup[] = [
  {
    label: "Serif",
    fonts: [
      "Georgia",
      "Times New Roman",
      "Garamond",
      "EB Garamond",
      "Palatino",
      "Baskerville",
      "Iowan Old Style",
      "Charter",
      "Merriweather",
      "Lora",
      "Crimson Text",
      "Libre Baskerville",
      "Source Serif Pro",
      "IBM Plex Serif",
      "Noto Serif",
    ],
  },
  {
    label: "Sans-serif",
    fonts: [
      "Helvetica Neue",
      "Helvetica",
      "Arial",
      "Inter",
      "Source Sans Pro",
      "IBM Plex Sans",
      "Noto Sans",
      "Segoe UI",
      "Verdana",
      "Tahoma",
      "Trebuchet MS",
      "DejaVu Sans",
      "Gill Sans",
      "Futura",
    ],
  },
  {
    label: "Monospace",
    fonts: [
      "DejaVu Sans Mono",
      "Courier New",
      "IBM Plex Mono",
      "Source Code Pro",
      "Menlo",
      "Consolas",
    ],
  },
  {
    label: "Arabic and Hebrew",
    fonts: [
      "Amiri",
      "Scheherazade New",
      "Noto Naskh Arabic",
      "Noto Sans Arabic",
      "Noto Serif Hebrew",
      "Noto Sans Hebrew",
    ],
  },
  {
    label: "CJK",
    fonts: [
      "Noto Serif CJK SC",
      "Noto Sans CJK SC",
      "Noto Serif CJK TC",
      "Source Han Serif",
      "Source Han Sans",
    ],
  },
  {
    label: "Devanagari",
    fonts: [
      "Noto Serif Devanagari",
      "Noto Sans Devanagari",
      "Lohit Devanagari",
    ],
  },
];

export const MIN_FONT_SIZE = 6;
export const MAX_FONT_SIZE = 24;
