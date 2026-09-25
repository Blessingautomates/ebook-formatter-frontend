/**
 * The bridge between the editor's HTML and the Markdown-flavoured text the
 * backend speaks.
 *
 * The extractor returns a Word heading as `# Heading` (services/extractors.py),
 * and the exporter's regexes read `**bold**` and `*italic*`
 * (services/exporter.py's `_MD_HEADING_RE`, `_STRONG_RE`, `_EMPHASIS_RE`). The
 * editor works in HTML, so both directions need converting somewhere; this
 * module is that place.
 *
 * Written by hand rather than pulled from a Markdown library: the node set is
 * closed by the toolbar — headings, paragraphs, bold, italic, lists, quotes and
 * scene breaks — and is small enough to state in full. A general library would
 * emit syntax the exporter does not understand, which is worse than not
 * emitting it at all.
 *
 * Both directions deliberately mirror the exporter's *ordering* rules. A scene
 * break is tested before a bullet in each, because `* * *` also matches the
 * bullet pattern; getting that order wrong turns every scene break into a
 * one-item list.
 */

import type { ChapterSummary } from "./types";

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const BULLET_RE = /^[-*+]\s+(.*)$/;
const QUOTE_RE = /^>\s?(.*)$/;
const SCENE_BREAK_RE = /^(?:\*\s*\*\s*\*|\*\*\*+|⁂|-{3,}|_{3,})$/;

/** The scene-break text the exporter writes and reads back. */
export const SCENE_BREAK = "* * *";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Apply the inline emphasis marks to already-escaped text.
 *
 * Bold first: run the other way round, `**word**` pairs its outer asterisks as
 * an italic and leaves the inner pair to be matched again. The exporter's
 * `_inline_markup` substitutes in this same order for the same reason.
 */
function inlineToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, "<em>$1</em>");
}

/** Markdown-flavoured manuscript text as HTML, for seeding the editor. */
export function markdownToHtml(markdown: string): string {
  const html: string[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];
  let quotes: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inlineToHtml(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const flushBullets = () => {
    if (bullets.length) {
      const items = bullets.map((item) => `<li>${inlineToHtml(item)}</li>`);
      html.push(`<ul>${items.join("")}</ul>`);
      bullets = [];
    }
  };
  const flushQuotes = () => {
    if (quotes.length) {
      html.push(`<blockquote><p>${inlineToHtml(quotes.join(" "))}</p></blockquote>`);
      quotes = [];
    }
  };

  for (const raw of markdown.split("\n")) {
    const line = raw.trim();

    if (!line) {
      // A blank line ends a paragraph but not a list, matching parse_blocks.
      flushParagraph();
      continue;
    }

    if (SCENE_BREAK_RE.test(line)) {
      flushParagraph();
      flushBullets();
      flushQuotes();
      html.push("<hr>");
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      flushParagraph();
      flushBullets();
      flushQuotes();
      const level = Math.min(heading[1].length, 6);
      html.push(`<h${level}>${inlineToHtml(heading[2].trim())}</h${level}>`);
      continue;
    }

    const bullet = BULLET_RE.exec(line);
    if (bullet) {
      flushParagraph();
      flushQuotes();
      bullets.push(bullet[1].trim());
      continue;
    }

    const quote = QUOTE_RE.exec(line);
    if (quote) {
      flushParagraph();
      flushBullets();
      quotes.push(quote[1].trim());
      continue;
    }

    flushBullets();
    flushQuotes();
    paragraph.push(line);
  }

  flushParagraph();
  flushBullets();
  flushQuotes();
  return html.join("");
}

/**
 * Inline content of one node as Markdown.
 *
 * Anything unrecognised (a `span`, `code`, a link) keeps its text and loses its
 * markup: the exporter has no syntax for them, so emitting markers it would
 * print literally is worse than dropping them.
 */
function inlineToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as HTMLElement;
  const inner = Array.from(element.childNodes).map(inlineToMarkdown).join("");

  switch (element.tagName) {
    case "STRONG":
    case "B":
      return inner.trim() ? `**${inner}**` : inner;
    case "EM":
    case "I":
      return inner.trim() ? `*${inner}*` : inner;
    case "BR":
      /*
       * A space, not a newline. `parse_blocks` joins a paragraph's lines with a
       * space, so a newline here would be a line break that survives in the
       * stored Markdown and disappears on the next load. The editor does not
       * offer hard breaks (see TiptapEditor), so this only catches one arriving
       * by paste — and flattens it the way the exporter would.
       */
      return " ";
    default:
      return inner;
  }
}

function collectBlock(node: Node, out: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? "").trim();
    if (text) out.push(text);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const element = node as HTMLElement;
  const tag = element.tagName;

  if (/^H[1-6]$/.test(tag)) {
    const level = Number(tag[1]);
    const text = inlineToMarkdown(element).trim();
    if (text) out.push(`${"#".repeat(level)} ${text}`);
    return;
  }

  if (tag === "HR") {
    out.push(SCENE_BREAK);
    return;
  }

  if (tag === "UL" || tag === "OL") {
    // `:scope > li` so a nested list's items are not also read as this list's.
    // Nesting flattens to one level, which is what the exporter renders.
    const items: string[] = [];
    element.querySelectorAll(":scope > li").forEach((item) => {
      const text = inlineToMarkdown(item).trim();
      if (text) items.push(`- ${text}`);
    });
    if (items.length) out.push(items.join("\n"));
    return;
  }

  if (tag === "BLOCKQUOTE") {
    const paragraphs = Array.from(element.querySelectorAll("p"));
    const text = paragraphs.length
      ? paragraphs.map((p) => inlineToMarkdown(p).trim()).join("\n")
      : inlineToMarkdown(element).trim();
    if (text) {
      out.push(
        text
          .split("\n")
          .map((line) => `> ${line}`.trimEnd())
          .join("\n"),
      );
    }
    return;
  }

  if (tag === "PRE") {
    // No code support in the exporter, so a code block becomes plain prose
    // rather than a fence it would print literally.
    const text = element.textContent?.trim();
    if (text) out.push(text);
    return;
  }

  const text = inlineToMarkdown(element).trim();
  if (text) out.push(text);
}

/** The editor's HTML as Markdown, for export and for saving to the project. */
export function htmlToMarkdown(html: string): string {
  if (typeof window === "undefined") return "";
  const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const blocks: string[] = [];
  parsed.body.childNodes.forEach((node) => collectBlock(node, blocks));
  return blocks.join("\n\n").trim();
}

export interface EditableChapter {
  title: string;
  /** 1-based line the heading is on, as the analyzer reported it. */
  lineNumber: number;
  /** The chapter's own body, as Markdown. */
  markdown: string;
  /**
   * Carried on the chapter rather than derived at render time. Recomputing
   * every chapter's count on each keystroke would walk the whole book to update
   * one number; the editor touches only the chapter it is editing.
   */
  wordCount: number;
}

/**
 * Cut the manuscript into one slice per chapter, using the line numbers
 * /api/analyze-book reported.
 *
 * The analyzer's numbers are 1-based and point at the heading line, and its
 * headings are the same ones the exporter splits on, so each slice includes its
 * own heading. A "Front Matter" entry, when the backend reports one, starts at
 * line 1 and so is handled by the same arithmetic.
 */
export function splitIntoChapters(
  text: string,
  chapters: ChapterSummary[],
): EditableChapter[] {
  const lines = text.split("\n");

  /*
   * A manuscript with no detectable heading still has to be editable, so it
   * becomes one section. The analyzer normally reports a single "Front Matter"
   * entry in this case; this is the belt to that pair of braces.
   */
  if (chapters.length === 0) {
    if (!text.trim()) return [];
    return [
      {
        title: "Manuscript",
        lineNumber: 1,
        markdown: text.trim(),
        wordCount: countWords(text),
      },
    ];
  }

  return chapters.map((chapter, index) => {
    const start = Math.max(chapter.line_number - 1, 0);
    const next = chapters[index + 1];
    const end = next ? Math.max(next.line_number - 1, start) : lines.length;
    const markdown = lines.slice(start, end).join("\n").trim();

    return {
      title: chapter.title,
      lineNumber: chapter.line_number,
      markdown,
      wordCount: countWords(markdown),
    };
  });
}

/** Matches services/chapters.py's FRONT_MATTER. */
const FRONT_MATTER = "Front Matter";

/**
 * Every chapter's Markdown, back into one manuscript.
 *
 * Joined with a blank line, which is what `parse_blocks` needs to see between a
 * paragraph and the next heading. This is the string the export receives and the
 * string that is saved; it is built at the moment it is needed rather than kept
 * in state, so a keystroke never joins the whole book.
 */
export function joinChapters(chapters: EditableChapter[]): string {
  return chapters
    .map((chapter) => chapter.markdown.trim())
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Re-derive the chapter breakdown from edited Markdown.
 *
 * `splitIntoChapters` trusts line numbers the analyzer reported for the
 * *uploaded* text. Once the manuscript has been edited those numbers describe a
 * document that no longer exists — a chapter added or deleted shifts every
 * later one — so a saved project stores this recomputed breakdown alongside its
 * content, and reopening slices on numbers that match the text being sliced.
 *
 * Only `#`-style headings are recognised, because that is the only heading form
 * the editor can produce or round-trip (`markdownToHtml` converts them and
 * `htmlToMarkdown` writes them back; a bare "Chapter One" line is a paragraph
 * to both). That is the same rule the exporter splits on.
 *
 * The shape matches the analyzer's `ChapterSummary[]`, including the "Front
 * Matter" entry for text above the first heading, so the two are
 * interchangeable everywhere downstream.
 */
export function chaptersFromMarkdown(markdown: string): ChapterSummary[] {
  const lines = markdown.split("\n");
  const starts: number[] = [];

  lines.forEach((line, index) => {
    if (HEADING_RE.test(line.trim())) starts.push(index);
  });

  if (starts.length === 0) {
    if (!markdown.trim()) return [];
    return [
      {
        title: FRONT_MATTER,
        line_number: 1,
        word_count: countWords(markdown),
      },
    ];
  }

  const sections: ChapterSummary[] = [];

  // Text above the first heading — a title page, a dedication — is a section of
  // its own rather than a silent prefix to chapter one.
  if (lines.slice(0, starts[0]).some((line) => line.trim())) {
    sections.push({
      title: FRONT_MATTER,
      line_number: 1,
      word_count: countWords(lines.slice(0, starts[0]).join("\n")),
    });
  }

  starts.forEach((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1] : lines.length;
    sections.push({
      title: lines[start].trim().replace(/^#{1,6}\s*/, ""),
      line_number: start + 1,
      word_count: countWords(lines.slice(start, end).join("\n")),
    });
  });

  return sections;
}

/**
 * How many chapters the manuscript has, by the analyzer's convention: the
 * "Front Matter" section is not a chapter, which is why this can be one less
 * than `chaptersFromMarkdown(...).length`.
 */
export function countChapters(chapters: ChapterSummary[]): number {
  return chapters.filter((chapter) => chapter.title !== FRONT_MATTER).length;
}

/**
 * A live word count for an edited chapter.
 *
 * Strips the block markers and emphasis so the number matches the count the
 * analyzer reported for the same text, rather than counting punctuation as
 * words.
 */
export function countWords(markdown: string): number {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/[*_]/g, "")
    .split(/\s+/)
    .filter(Boolean).length;
}
