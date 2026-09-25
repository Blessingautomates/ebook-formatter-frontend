"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Notice } from "@/components/primitives";
import {
  countWords,
  htmlToMarkdown,
  markdownToHtml,
  splitIntoChapters,
  type EditableChapter,
} from "@/lib/editorContent";
import { MAX_FONT_SIZE, MIN_FONT_SIZE } from "@/lib/fonts";
import { DEFAULT_FONT, type GoogleFont } from "@/lib/googleFonts";
import type { ChapterSummary } from "@/lib/types";

import { ChapterNav } from "./ChapterNav";
import { FontPanel } from "./FontPanel";
import { TiptapEditor } from "./TiptapEditor";

/**
 * What the workspace reports upward. `edited` is false for a manuscript that has
 * been opened but not typed into, which is what lets the parent keep the
 * analyzer's chapter breakdown instead of recomputing a coarser one from the
 * editor's own heading syntax.
 */
export interface EditorState {
  chapters: EditableChapter[];
  edited: boolean;
}

/**
 * Chapter navigation, the editing canvas and the typography panel, side by side.
 *
 * The workspace owns the chapter state and reports it upward on every change.
 * The parent holds the array but does not serialize it — turning the chapters
 * into one manuscript string is done where it is needed (export, save), so a
 * keystroke never walks the whole book.
 *
 * Mount it with a `key` that identifies the manuscript being edited. It seeds
 * its state once, so a different manuscript needs a different key to be picked
 * up.
 */
export function ManuscriptWorkspace({
  text,
  chapters,
  onChange,
}: {
  /** The corrected manuscript, Markdown-flavoured, as the backend returned it. */
  text: string;
  /** The analyzer's chapter breakdown, whose line numbers slice `text`. */
  chapters: ChapterSummary[];
  onChange: (state: EditorState) => void;
}) {
  /*
   * Snapshotted once, at mount, so "revert this chapter" always restores the
   * text the author was first shown — not whatever the corrected text has since
   * become after further spelling decisions, which they never saw in the
   * editor. It also keeps a full re-split off the render path when the parent
   * re-renders.
   *
   * Filled lazily rather than through `useRef(splitIntoChapters(...))`, which
   * would evaluate the split on every render and throw the result away.
   */
  const originalRef = useRef<EditableChapter[] | null>(null);
  if (originalRef.current === null) {
    originalRef.current = splitIntoChapters(text, chapters);
  }
  const original = originalRef.current;

  const [edited, setEdited] = useState<EditableChapter[]>(original);
  /*
   * Whether anything has actually been typed. The parent uses this to decide
   * whether to recompute the chapter breakdown on save: an untouched manuscript
   * keeps the analyzer's breakdown, which can see structure the editor cannot
   * (a bare "Chapter One" line is a chapter to the analyzer and a paragraph to
   * the editor). Once the text has really changed those line numbers no longer
   * describe it, and only a recomputation can slice it correctly.
   */
  const [dirty, setDirty] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [font, setFont] = useState<GoogleFont>(DEFAULT_FONT);
  const [fontSize, setFontSize] = useState(11);

  /*
   * Held in a ref so the reporting effect below depends only on what is being
   * reported. With the callback in the dependency list, a parent that re-renders
   * with a fresh function identity would re-report on every render.
   */
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onChangeRef.current({ chapters: edited, edited: dirty });
  }, [edited, dirty]);

  const active = edited[activeIndex] ?? null;

  /*
   * Bumped to force the editor to reload the active chapter when its text is
   * replaced from underneath it — currently only by "revert". `activeHtml` is
   * keyed on this too, for the same reason.
   */
  const [reloadNonce, setReloadNonce] = useState(0);

  /*
   * Identifies what the editor should be showing. A change means "load this",
   * and it deliberately does not include the chapter's text — see below.
   */
  const chapterKey = `${activeIndex}:${reloadNonce}`;

  /*
   * The latest chapters, readable from inside a memo that must not depend on
   * them. See `activeHtml` below.
   */
  const editedRef = useRef(edited);
  editedRef.current = edited;

  /*
   * The active chapter's HTML, rebuilt only when a *different* chapter is
   * opened or the current one is reloaded. Keying on the content instead would
   * rebuild it on every keystroke and, because the editor reloads whenever the
   * value it is handed changes, would fight the cursor. This is the same reason
   * TiptapEditor syncs on its `chapterKey` rather than on `html`.
   *
   * Read through the ref so `edited` is not a dependency: the memo must capture
   * the chapter's text at the moment the key changes, not follow it afterwards.
   */
  const activeHtml = useMemo(() => {
    const chapter = editedRef.current[activeIndex];
    return chapter ? markdownToHtml(chapter.markdown) : "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterKey]);

  function handleEditorChange(html: string): void {
    const markdown = htmlToMarkdown(html);
    setDirty(true);
    setEdited((current) => {
      const chapter = current[activeIndex];
      if (!chapter) return current;
      const next = [...current];
      next[activeIndex] = {
        ...chapter,
        markdown,
        wordCount: countWords(markdown),
      };
      return next;
    });
  }

  function revertActiveChapter(): void {
    const source = original[activeIndex];
    if (!source) return;
    const next = [...edited];
    next[activeIndex] = source;
    setEdited(next);
    // Exact, and only on an explicit press — the per-keystroke path above just
    // assumes it is dirty rather than comparing the whole book.
    setDirty(next.some((c, i) => c.markdown !== original[i]?.markdown));
    // The editor is showing the reverted-away text and would ignore a new
    // `html` prop, so the reload has to be asked for.
    setReloadNonce((nonce) => nonce + 1);
  }

  if (!active) {
    return (
      <Notice>
        There is no text to edit. The analyzer returned no chapters and no
        manuscript body for this file.
      </Notice>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)_15rem]">
      <ChapterNav
        chapters={edited}
        activeIndex={activeIndex}
        onSelect={setActiveIndex}
      />

      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-serif text-base font-semibold">{active.title}</h3>
          <button
            type="button"
            className="btn btn-sm"
            onClick={revertActiveChapter}
            disabled={active.markdown === original[activeIndex]?.markdown}
          >
            Revert this chapter
          </button>
        </div>

        <TiptapEditor
          html={activeHtml}
          chapterKey={chapterKey}
          fontFamily={`"${font.family}", ${font.fallback}`}
          fontSize={fontSize}
          onChange={handleEditorChange}
        />

        <p className="mt-2 text-xs leading-relaxed text-muted">
          Edits here are what the export renders. Reverting restores the chapter
          as it was when this editor opened — corrections accepted in the
          pre-scan afterwards are not applied retroactively.
        </p>
      </div>

      <FontPanel
        selected={font}
        onSelect={setFont}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        minSize={MIN_FONT_SIZE}
        maxSize={MAX_FONT_SIZE}
      />
    </div>
  );
}
