"use client";

import type { EditableChapter } from "@/lib/editorContent";

const number = new Intl.NumberFormat();

/**
 * The chapter list, used to choose which chapter the editor is showing.
 *
 * Scrolls rather than grows: a ninety-chapter book would otherwise push the
 * editor off the screen, and the editor is the point of the panel.
 */
export function ChapterNav({
  chapters,
  activeIndex,
  onSelect,
}: {
  chapters: EditableChapter[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const total = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);

  return (
    <nav className="card flex min-h-0 flex-col p-3" aria-label="Chapters">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="label mb-0">Chapters</span>
        <span className="font-mono text-xs text-faint tabular-nums">
          {number.format(total)}
        </span>
      </div>

      {chapters.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted">
          No chapter headings were found in this manuscript, so there is nothing
          to navigate. The text is still editable as a single section.
        </p>
      ) : (
        <ul className="-mx-1 max-h-[26rem] min-h-0 space-y-0.5 overflow-y-auto px-1 lg:max-h-none">
          {chapters.map((chapter, index) => {
            const selected = index === activeIndex;
            return (
              <li key={`${chapter.lineNumber}-${chapter.title}`}>
                <button
                  type="button"
                  onClick={() => onSelect(index)}
                  aria-current={selected ? "true" : undefined}
                  className={`w-full rounded-lg px-2 py-1.5 text-left transition-colors ${
                    selected
                      ? "bg-accent-soft text-accent"
                      : "text-ink hover:bg-surface-2"
                  }`}
                >
                  <span className="block truncate text-sm font-medium">
                    {chapter.title}
                  </span>
                  <span
                    className={`block font-mono text-[0.7rem] tabular-nums ${
                      selected ? "text-accent" : "text-faint"
                    }`}
                  >
                    {number.format(chapter.wordCount)} words
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
