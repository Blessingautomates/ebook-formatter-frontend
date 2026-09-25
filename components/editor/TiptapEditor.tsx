"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/** `as const` so each entry stays a literal, which is the `Level` Tiptap wants. */
const HEADING_LEVELS = [1, 2, 3] as const;

function ToolButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // aria-pressed carries the on/off state to a screen reader; the colour
      // alone would not.
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`btn btn-sm editor-tool ${
        active ? "border-accent bg-accent-soft text-accent" : ""
      }`}
    >
      {children}
    </button>
  );
}

/**
 * The formatting toolbar.
 *
 * The active and enabled states are read through `useEditorState` rather than
 * straight off the editor. In Tiptap v3 the React tree is *not* re-rendered on
 * every transaction by default (`shouldRerenderOnTransaction` is false), so
 * reading `editor.isActive(...)` during render would leave the highlights and
 * the undo/redo states frozen at whatever they were when the editor mounted.
 * The hook subscribes and deep-compares the selected slice, so this re-renders
 * when one of these booleans actually changes and not on every keystroke.
 */
function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      h1: current.isActive("heading", { level: 1 }),
      h2: current.isActive("heading", { level: 2 }),
      h3: current.isActive("heading", { level: 3 }),
      bulletList: current.isActive("bulletList"),
      blockquote: current.isActive("blockquote"),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Formatting">
      <ToolButton
        label="Bold"
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <strong>B</strong>
      </ToolButton>
      <ToolButton
        label="Italic"
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <em>I</em>
      </ToolButton>

      <span className="editor-toolbar-divider" aria-hidden />

      {HEADING_LEVELS.map((level) => (
        <ToolButton
          key={level}
          label={`Heading ${level}`}
          active={state[`h${level}` as "h1" | "h2" | "h3"]}
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
        >
          H{level}
        </ToolButton>
      ))}

      <span className="editor-toolbar-divider" aria-hidden />

      <ToolButton
        label="Bullet list"
        active={state.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <span aria-hidden>•—</span>
      </ToolButton>
      <ToolButton
        label="Blockquote"
        active={state.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <span aria-hidden>❝</span>
      </ToolButton>

      <span className="editor-toolbar-divider" aria-hidden />

      <ToolButton
        label="Undo"
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <span aria-hidden>↶</span>
      </ToolButton>
      <ToolButton
        label="Redo"
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <span aria-hidden>↷</span>
      </ToolButton>
    </div>
  );
}

export function TiptapEditor({
  html,
  chapterKey,
  fontFamily,
  fontSize,
  readOnly = false,
  onChange,
}: {
  /** The active chapter's content, as HTML. */
  html: string;
  /**
   * Identifies the chapter being edited. When this changes the editor loads the
   * new `html`; when only `html` changes, that is the author typing.
   */
  chapterKey: string;
  /** The CSS family stack from the font panel. */
  fontFamily: string;
  /** Point size for the canvas. */
  fontSize: number;
  readOnly?: boolean;
  onChange: (html: string) => void;
}) {
  /*
   * Held in a ref so the editor is not torn down and rebuilt when the parent
   * re-renders with a fresh callback identity — which, with `onChange` in the
   * hook's dependency list, would reset the document and lose the cursor on
   * every keystroke.
   */
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    // The dashboard is server-rendered, so rendering the editor on the first
    // client pass would produce markup the server never sent.
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        /*
         * Switched off because the export pipeline has no syntax for them
         * (services/exporter.py). Leaving them on would let a paste introduce
         * markup that the exporter would silently flatten, which is exactly the
         * fidelity gap this phase set out to avoid.
         *
         * `hardBreak` is on that list for the same reason even though it is not
         * markup: a newline inside a paragraph is joined with a space by
         * `parse_blocks`, so a Shift+Enter would survive on screen and not in
         * the PDF. Since the Markdown form is what gets re-loaded when a chapter
         * is reopened, it would also appear to vanish on the next chapter
         * switch. A break that cannot be rendered should not be offered.
         */
        code: false,
        codeBlock: false,
        link: false,
        strike: false,
        underline: false,
        orderedList: false,
        hardBreak: false,
      }),
      Placeholder.configure({ placeholder: "This chapter is empty." }),
    ],
    content: html,
    onUpdate: ({ editor: current }) => onChangeRef.current(current.getHTML()),
    editorProps: {
      attributes: { class: "editor-prose", spellcheck: "true" },
    },
  });

  /*
   * Load the chapter when the *selection* changes, keyed on `chapterKey` rather
   * than on `html`. Both change while typing, so keying on the content would
   * reset the document mid-keystroke and throw the cursor to the start.
   */
  const loadedKey = useRef(chapterKey);
  useEffect(() => {
    if (!editor || loadedKey.current === chapterKey) return;
    loadedKey.current = chapterKey;
    /*
     * `emitUpdate: false` because opening a chapter is not an edit. Emitting
     * would report it as one, marking the project dirty on every navigation and
     * overwriting the stored text with an identical copy.
     */
    editor.commands.setContent(html, { emitUpdate: false });
  }, [editor, chapterKey, html]);

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  if (!editor) {
    return (
      <div className="editor-surface grid place-items-center text-sm text-muted">
        Loading the editor…
      </div>
    );
  }

  return (
    <div
      className="editor-surface"
      style={
        {
          "--editor-font": fontFamily,
          "--editor-size": `${fontSize}pt`,
        } as CSSProperties
      }
    >
      {readOnly ? null : <Toolbar editor={editor} />}
      <EditorContent editor={editor} className="editor-body" />
    </div>
  );
}
