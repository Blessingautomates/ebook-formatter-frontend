/**
 * The runtime Google Fonts engine.
 *
 * Families are fetched by injecting a stylesheet link, not with
 * `next/font/google`. That helper resolves its families at build time, and
 * these are chosen by the author at runtime, so the build cannot know which to
 * fetch or subset.
 *
 * This is a *preview* font. The export is rendered server-side by WeasyPrint,
 * which resolves families installed on the server, so choosing Literata here
 * still needs Literata installed there before the PDF will use it. The panel
 * says so rather than implying the choice is binding on the export.
 */

export interface GoogleFont {
  family: string;
  category: "serif" | "sans-serif";
  /** The weights to request. Kept to what a book actually sets. */
  weights: number[];
  /** Used for the specimen before the webfont arrives, and on any failure. */
  fallback: string;
  /** Shown under the specimen, so the choice is not made on shape alone. */
  blurb: string;
}

export const GOOGLE_FONTS: GoogleFont[] = [
  {
    family: "Merriweather",
    category: "serif",
    weights: [300, 400, 700],
    fallback: "Georgia, serif",
    blurb: "Sturdy screen-first serif with tall x-height.",
  },
  {
    family: "Playfair Display",
    category: "serif",
    weights: [400, 700],
    fallback: '"Times New Roman", serif',
    blurb: "High-contrast display face for titles and covers.",
  },
  {
    family: "Lora",
    category: "serif",
    weights: [400, 500, 700],
    fallback: "Georgia, serif",
    blurb: "Brushy calligraphic roots, calm at body size.",
  },
  {
    family: "EB Garamond",
    category: "serif",
    weights: [400, 500, 700],
    fallback: "Garamond, serif",
    blurb: "Old-style Garamond, the classic book face.",
  },
  {
    family: "Literata",
    category: "serif",
    weights: [400, 600, 700],
    fallback: "Georgia, serif",
    blurb: "Designed for long-form e-reading.",
  },
  {
    family: "Inter",
    category: "sans-serif",
    weights: [400, 500, 700],
    fallback: "system-ui, sans-serif",
    blurb: "Neutral sans for technical and non-fiction.",
  },
];

const PRELOAD_ID = "gfont-preconnect";
const LINK_PREFIX = "gfont-";

/** Families whose stylesheet has already been requested, so it is asked for once. */
const requested = new Set<string>();

function slug(family: string): string {
  return family.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function ensurePreconnect(): void {
  if (document.getElementById(PRELOAD_ID)) return;
  const preconnect = document.createElement("link");
  preconnect.id = PRELOAD_ID;
  preconnect.rel = "preconnect";
  // The stylesheet itself is on googleapis; the font files it points at are on
  // gstatic, and opening that connection early is what removes the swap delay.
  preconnect.href = "https://fonts.gstatic.com";
  preconnect.crossOrigin = "anonymous";
  document.head.appendChild(preconnect);
}

/**
 * Fetch `font`'s stylesheet if it has not been fetched already.
 *
 * Safe to call repeatedly and on every render: the guard is both the module
 * set and the DOM id, so a hot reload or a second component asking for the same
 * family does not add a duplicate link.
 */
export function loadGoogleFont(font: GoogleFont): void {
  if (typeof document === "undefined") return;

  const id = `${LINK_PREFIX}${slug(font.family)}`;
  if (requested.has(id) || document.getElementById(id)) return;

  ensurePreconnect();

  const family = font.family.replace(/ /g, "+");
  const weights = [...font.weights].sort((a, b) => a - b).join(";");

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@${weights}&display=swap`;
  document.head.appendChild(link);

  requested.add(id);
}

/** The CSS stack to apply: the family quoted, with its fallback kept. */
export function fontStack(font: GoogleFont): string {
  return `"${font.family}", ${font.fallback}`;
}

/** The picker's default, and the family a new session starts on. */
export const DEFAULT_FONT = GOOGLE_FONTS[0];
