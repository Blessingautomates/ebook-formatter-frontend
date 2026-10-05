"use client";

import { useEffect, useMemo, useState } from "react";

import { AdvancedSettings } from "@/components/AdvancedSettings";
import { AnalysisDashboard } from "@/components/AnalysisDashboard";
import { Dropzone } from "@/components/Dropzone";
import { ExportHub } from "@/components/ExportHub";
import { GenreSelector } from "@/components/GenreSelector";
import { CommentsDrawer } from "@/components/collab/CommentsDrawer";
import { CoverDrawer } from "@/components/cover/CoverDrawer";
import { ApprovalModal } from "@/components/publish/ApprovalModal";
import { Notice, Spinner, Step } from "@/components/primitives";
import {
  ChatIcon,
  CoverIcon,
  ShieldIcon,
} from "@/components/shell/icons";
import { useWorkspace } from "@/components/shell/workspace-context";
import { TypoDrawer } from "@/components/TypoDrawer";
import {
  ManuscriptWorkspace,
  type EditorState,
} from "@/components/editor/ManuscriptWorkspace";
import { analyzeBook, exportBook } from "@/lib/api";
import {
  latestCoverAsset,
  type CoverAsset,
  type PaperStock,
} from "@/lib/covers";
import {
  chaptersFromMarkdown,
  countChapters,
  countWords,
  joinChapters,
} from "@/lib/editorContent";
import {
  saveManuscript,
  type ManuscriptDraft,
  type ManuscriptRecord,
} from "@/lib/manuscripts";
import { estimatedPages } from "@/lib/readiness";
import { applyFixes, buildRows, type Decision, type Decisions } from "@/lib/typos";
import type { BookAnalysis, ExportFormat, ExportSettings } from "@/lib/types";
import type { WorkspaceRole } from "@/lib/workspaces";

type Status = "idle" | "analyzing" | "ready";

/**
 * A draft before the editor has had its say.
 *
 * `content` is deliberately absent: it is the whole manuscript as one string,
 * and putting it in the memo below would rebuild that string on every keystroke.
 * It is joined at the moment of saving instead.
 */
type DraftBase = Omit<ManuscriptDraft, "content">;

const INITIAL_SETTINGS: ExportSettings = {
  title: "",
  author: "",
  genre: "fiction",
  trimSize: "6x9",
  customFont: "",
  fontSize: null,
};

/** "my-book_draft.docx" becomes "my book draft". */
function titleFromFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim() || "Untitled";
}

function messageFor(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** The settings a saved book reopens with. */
function settingsFromRecord(record: ManuscriptRecord): ExportSettings {
  return {
    title: record.title,
    // Author is stored because it is part of the exported title page, not just
    // a label on the row.
    author: record.author ?? "",
    genre: record.genre,
    trimSize: record.trim_size,
    customFont: record.font_family ?? "",
    fontSize: record.font_size,
  };
}

/**
 * One book's workflow: upload, pre-scan, edit, layout, export.
 *
 * This is the page that used to be the whole dashboard, lifted into a component
 * so it can be mounted at /dashboard/books/new and /dashboard/books/[id] rather
 * than only at /dashboard. The steps, the state and the comments explaining
 * them are unchanged; what moved out is the chrome (the sidebar and header now
 * come from the shell), the saved-projects list (that is the dashboard grid)
 * and the plan button (the shell owns the account menu).
 *
 * Mount it with `key` set to the record id, or "new". The editor seeds its
 * state once and ignores later prop changes, so a different book needs a
 * different key to be picked up.
 */
export function BookWorkspace({
  record,
  onSaved,
}: {
  /** The saved book being edited, or null when starting a new one. */
  record: ManuscriptRecord | null;
  /** Called with the stored row after a successful save, so a list can refresh. */
  onSaved?: (saved: ManuscriptRecord) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<BookAnalysis | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const [decisions, setDecisions] = useState<Decisions>({});
  const [typosOpen, setTyposOpen] = useState(false);

  /*
   * Settings seed from the opened book, and from the analyzer's filename guess
   * for a new one. Seeded once rather than synced in an effect: `record` is
   * fixed for the life of this mount (the parent keys on it), and syncing would
   * fight the user's own edits to the title field.
   */
  const [settings, setSettings] = useState<ExportSettings>(
    record ? settingsFromRecord(record) : INITIAL_SETTINGS,
  );

  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);

  /**
   * What the editor currently holds, or null when it is not mounted.
   *
   * The chapters live here rather than inside the workspace so export and save
   * can read them, but nothing here joins them into a string — see `DraftBase`.
   */
  const [editorState, setEditorState] = useState<EditorState | null>(null);

  /**
   * The saved row this session is writing to. Starts as the opened book, and
   * becomes the new row's id after the first save of a fresh book — which is
   * what makes the second save an update rather than a duplicate.
   */
  const [activeId, setActiveId] = useState<string | null>(record?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  /*
   * A book reopened from the grid whose text was stored. Its content is what
   * the editor must show, and it wins over any analysis — see `workspaceSource`
   * for why the two are not interchangeable.
   */
  const [openProject, setOpenProject] = useState<ManuscriptRecord | null>(record);

  /** Which workspace a first save files the book into. */
  const { active } = useWorkspace();

  /*
   * What the reader may do here. Someone in their own workspace is its owner —
   * a personal workspace is created with them as owner, and while the list is
   * still loading `active` is null, so "owner" is also the honest default for
   * "your own book".
   */
  const role: WorkspaceRole = active?.role ?? "owner";

  /*
   * The publishing trio — review notes, the cover check, and the final sign-off.
   * They are opened from the header rather than living in a step of their own,
   * because all three act on the book as a whole rather than moving the
   * workflow forward.
   */
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [signOffOpen, setSignOffOpen] = useState(false);

  /*
   * The cover is held here, not in the drawer, because two things need it: the
   * signature gate, which reads its verdict, and the package, which ships the
   * file itself. The paper stock is shared for the same reason — the spine in
   * the archive has to be the spine that was measured.
   */
  const [coverAsset, setCoverAsset] = useState<CoverAsset | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [paper, setPaper] = useState<PaperStock>("white");

  useEffect(() => {
    if (!activeId) {
      setCoverAsset(null);
      return;
    }
    let cancelled = false;
    latestCoverAsset(activeId)
      .then((asset) => {
        if (!cancelled) setCoverAsset(asset);
      })
      .catch(() => {
        // A cover we cannot read is not worth blocking the workspace over; the
        // sign-off says "not checked" rather than claiming a result.
        if (!cancelled) setCoverAsset(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const rows = useMemo(() => buildRows(analysis?.typos ?? []), [analysis]);

  /**
   * The manuscript with every accepted correction applied. Recomputed as the
   * decisions change; null when the server did not return the text, in which
   * case the export falls back to re-uploading the original file.
   */
  const corrected = useMemo(() => {
    const text = analysis?.manuscript_text;
    if (!text) return { text: null, applied: 0 };
    const result = applyFixes(text, rows, decisions);
    return { text: result.text, applied: result.applied };
  }, [analysis, rows, decisions]);

  function reset(): void {
    setFile(null);
    setAnalysis(null);
    setStatus("idle");
    setError(null);
    setDecisions({});
    setTyposOpen(false);
    setExporting(null);
    setExportError(null);
    setLastExport(null);
    // The editor belongs to the manuscript being discarded; leaving its
    // chapters in place would let a stray save write them to the next project.
    setEditorState(null);
    // Starting over means starting a *new* manuscript, so the next save must
    // insert rather than overwrite the book that was open.
    setActiveId(null);
    setOpenProject(null);
    setSaveError(null);
    setSaveNotice(null);
  }

  async function handleFile(next: File): Promise<void> {
    setFile(next);
    setAnalysis(null);
    setDecisions({});
    // A new upload replaces the whole manuscript, so the editor must re-seed
    // from the analysis rather than keep the previous book's chapters.
    setEditorState(null);
    setExportError(null);
    setLastExport(null);
    setError(null);
    setStatus("analyzing");
    setSettings((current) => ({
      ...current,
      title: current.title || titleFromFilename(next.name),
    }));

    try {
      const result = await analyzeBook(next);
      setAnalysis(result);
      setStatus("ready");
      // Open the drawer straight away when there is something to review.
      setTyposOpen(result.typo_check_available && result.typo_count > 0);
    } catch (caught) {
      setError(messageFor(caught, "The manuscript could not be analyzed."));
      setStatus("idle");
    }
  }

  function decide(key: string, decision: Decision | null): void {
    setDecisions((current) => {
      const next = { ...current };
      if (decision) next[key] = decision;
      else delete next[key];
      return next;
    });
  }

  function bulk(keys: string[], decision: Decision | null): void {
    setDecisions((current) => {
      const next = { ...current };
      for (const key of keys) {
        if (decision) next[key] = decision;
        else delete next[key];
      }
      return next;
    });
  }

  async function handleExport(format: ExportFormat): Promise<void> {
    if (!analysis) return;
    setExporting(format);
    setExportError(null);
    setLastExport(null);
    try {
      const filename = await exportBook({
        // The editor's edits, when there are any; the corrected analyzer text
        // otherwise. `file` stays as the fallback for a manuscript the server
        // returned no text for, which `exportBook` handles.
        text: manuscriptText(),
        file,
        analysis,
        settings,
        format,
      });
      setLastExport(filename);
    } catch (caught) {
      setExportError(messageFor(caught, "The export failed."));
    } finally {
      setExporting(null);
    }
  }

  const ready = analysis !== null;

  /**
   * What the editor should be showing, or null when there is nothing to edit.
   *
   * A reopened book with stored text wins even once a fresh analysis has
   * arrived, and the two are not interchangeable. The analyzer supplies the
   * language, script and text direction the export needs — none of which are
   * stored with a book — so reopening one means uploading the original file
   * again. Re-seeding the editor from that upload would discard the very edits
   * the book was reopened for, so the stored text stays and the analysis is
   * used only for what it alone knows. Its key is the book id, which is why the
   * analysis landing does not remount the editor.
   *
   * `key` exists because the workspace seeds its state once and ignores later
   * prop changes. It identifies the manuscript, not its contents — keying on
   * the text would remount the editor on every accepted spelling correction and
   * throw away whatever had been typed.
   */
  const workspaceSource = useMemo(() => {
    if (openProject?.content) {
      return {
        key: `project:${openProject.id}`,
        text: openProject.content,
        chapters: openProject.chapters,
      };
    }

    // Checked rather than merely non-null: with no extracted text there is
    // nothing to edit, and the step should say so rather than open an editor on
    // a book of empty chapters.
    if (analysis?.manuscript_text) {
      return {
        key: `analysis:${file?.name ?? ""}:${file?.lastModified ?? 0}`,
        text: corrected.text ?? analysis.manuscript_text,
        chapters: analysis.chapters,
      };
    }

    return null;
  }, [analysis, file, corrected.text, openProject]);

  /**
   * The manuscript as it should be exported or saved.
   *
   * The editor wins once it has been typed into. Until then the seeded text is
   * preferred over any other copy of it, because it is the one the chapter line
   * numbers describe and it has not been through a Markdown → HTML → Markdown
   * round trip, which comes back with normalised blank lines.
   */
  function manuscriptText(): string | null {
    if (editorState?.edited) return joinChapters(editorState.chapters);
    return workspaceSource?.text ?? corrected.text ?? null;
  }

  /**
   * The draft plus the manuscript text.
   *
   * An untouched manuscript keeps its stored breakdown as well as its text. The
   * analyzer can see structure the editor cannot — it reads a bare "Chapter One"
   * line as a chapter heading, where the editor sees a paragraph and can only
   * round-trip `#`-style headings — so recomputing the breakdown for a book
   * nobody has edited would silently lose chapters.
   *
   * Once the text has really changed, though, those line numbers describe a
   * document that no longer exists and only a recomputation slices the stored
   * text correctly. The counts are restated for the same reason: they are
   * measurements *of* the manuscript, and the manuscript has changed.
   */
  function withContent(base: DraftBase): ManuscriptDraft {
    if (!editorState?.edited) {
      return { ...base, content: manuscriptText() };
    }

    const content = joinChapters(editorState.chapters);
    const chapters = chaptersFromMarkdown(content);
    const words = countWords(content);
    return {
      ...base,
      content,
      chapters,
      chapter_count: countChapters(chapters),
      word_count: words,
      // Restated with the word count: page count is derived from it, so leaving
      // the stored value alone would put a stale spine width on the cover.
      page_count: estimatedPages(words),
    };
  }

  /**
   * The row to write, or null when there is nothing to write yet.
   *
   * Measurements come from the live analysis when there is one. Falling back to
   * the opened book's stored numbers is what lets someone reopen a saved
   * manuscript, change only its genre, and save that — the file they would
   * otherwise have to re-upload to produce measurements is not here.
   */
  const draft: DraftBase | null = useMemo(() => {
    const shared = {
      title: settings.title.trim() || "Untitled",
      author: settings.author.trim() || null,
      genre: settings.genre,
      font_family: settings.customFont.trim() || null,
      font_size: settings.fontSize,
      trim_size: settings.trimSize,
      /*
       * The analyzer's detection when there is one, and the opened book's
       * stored value otherwise — so saving a layout tweak to a reopened book
       * does not blank the language the grid badges.
       */
      language: analysis?.detected_language ?? openProject?.language ?? null,
      /*
       * An existing book keeps the workspace it is already filed in, even if
       * the switcher has since moved: saving a layout tweak must not silently
       * transfer someone's book into whatever workspace happens to be open.
       * Only a first save consults the active workspace.
       */
      workspace_id: openProject?.workspace_id ?? active?.workspace.id ?? null,
      page_count: estimatedPages(
        analysis?.word_count ?? openProject?.word_count ?? 0,
      ),
    };

    if (analysis) {
      return {
        ...shared,
        word_count: analysis.word_count,
        chapter_count: analysis.chapter_count,
        chapters: analysis.chapters,
      };
    }

    if (openProject) {
      return {
        ...shared,
        word_count: openProject.word_count,
        chapter_count: openProject.chapter_count,
        chapters: openProject.chapters,
      };
    }

    return null;
  }, [analysis, openProject, settings, active]);

  async function handleSave(): Promise<void> {
    if (!draft || saving) return;
    const updating = activeId !== null;
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    try {
      const saved = await saveManuscript(withContent(draft), activeId);
      setActiveId(saved.id);
      /*
       * The editor is now showing a saved manuscript, so it is no longer "the
       * analyzer's text" — swapping the source keeps a later save from
       * re-deriving a breakdown the editor has since invalidated.
       */
      setOpenProject(saved);
      setSaveNotice(`${updating ? "Updated" : "Saved"} “${saved.title}”.`);
      onSaved?.(saved);
    } catch (caught) {
      setSaveError(messageFor(caught, "The book could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl leading-tight font-semibold tracking-tight">
            {settings.title.trim() || "Untitled book"}
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            {openProject?.content
              ? "Your saved text is loaded in the editor. Upload the original file again to enable export — your edits are kept."
              : openProject
                ? "This book was saved without its text. Upload the manuscript again to export it."
                : "Upload a manuscript to measure it, review the spelling findings, and export."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/*
            Comments and the cover check both attach to a saved row. A book that
            has never been saved has no id to file either against, so the
            buttons wait rather than opening a drawer that cannot write.
          */}
          <button
            type="button"
            className="btn"
            disabled={activeId === null}
            title={
              activeId === null
                ? "Save this book before leaving notes on it."
                : "Review notes from collaborators"
            }
            onClick={() => setCommentsOpen(true)}
          >
            <ChatIcon className="size-4" />
            Comments
          </button>
          <button
            type="button"
            className="btn"
            disabled={activeId === null}
            title={
              activeId === null
                ? "Save this book before checking a cover against its spine."
                : "Upload and measure a cover"
            }
            onClick={() => setCoverOpen(true)}
          >
            <CoverIcon className="size-4" />
            Cover
          </button>
          <button
            type="button"
            className="btn"
            disabled={draft === null || activeId === null}
            title={
              draft === null
                ? "There is no manuscript to publish yet."
                : activeId === null
                  ? "Save this book before the final sign-off."
                  : "Final checks and the publishing package"
            }
            onClick={() => setSignOffOpen(true)}
          >
            <ShieldIcon className="size-4" />
            Publish
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleSave()}
            disabled={draft === null || saving}
          >
            {saving ? <Spinner /> : null}
            {activeId ? "Save changes" : "Save this book"}
          </button>
          {file && status === "ready" ? (
            <button type="button" className="btn" onClick={reset}>
              Start over
            </button>
          ) : null}
        </div>
      </div>

      {saveError ? <Notice tone="error">{saveError}</Notice> : null}
      {saveNotice ? <Notice tone="ok">{saveNotice}</Notice> : null}
      {draft === null && !saving ? (
        <Notice>
          Analyze a manuscript, or open a saved book that has one stored, to
          enable saving.
        </Notice>
      ) : null}

      <Step
        n={1}
        id="manuscript"
        title="Manuscript"
        hint="A .docx, .md or .txt file."
        active
      >
        <Dropzone
          file={file}
          busy={status === "analyzing"}
          error={error}
          onFile={handleFile}
          onInvalid={setError}
          onReset={reset}
        />
      </Step>

      {analysis ? (
        <Step
          n={2}
          id="prescan"
          title="Pre-scan"
          hint={`Measured from ${analysis.language_name}, ${analysis.script_type} script.`}
        >
          <AnalysisDashboard
            analysis={analysis}
            onOpenTypos={() => setTyposOpen((open) => !open)}
          />
          <TypoDrawer
            open={typosOpen}
            onToggle={() => setTyposOpen((open) => !open)}
            available={analysis.typo_check_available}
            note={analysis.typo_check_note}
            totalCount={analysis.typo_count}
            listedCount={analysis.typos.length}
            rows={rows}
            decisions={decisions}
            onDecide={decide}
            onBulk={bulk}
            appliedCount={corrected.applied}
          />
        </Step>
      ) : null}

      <Step
        n={3}
        id="edit"
        title="Edit"
        hint="Chapter by chapter, set in the type it will be printed in."
        active={workspaceSource !== null}
      >
        {workspaceSource ? (
          <ManuscriptWorkspace
            // Identifies the manuscript, not its contents — see
            // `workspaceSource`. A different key is what makes the workspace
            // re-seed; the same key leaves whatever has been typed alone.
            key={workspaceSource.key}
            text={workspaceSource.text}
            chapters={workspaceSource.chapters}
            onChange={setEditorState}
          />
        ) : (
          <Notice>
            Analyze a manuscript — or open a saved book that has one stored — to
            edit it here. Edits become the text the export renders.
          </Notice>
        )}
      </Step>

      <Step
        n={4}
        id="layout"
        title="Genre and layout"
        hint="Sets the typography and page furniture of the export."
        active={ready}
      >
        <GenreSelector
          value={settings.genre}
          onChange={(genre) => setSettings((s) => ({ ...s, genre }))}
        />
        <div className="mt-3">
          <AdvancedSettings
            settings={settings}
            onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
          />
        </div>
      </Step>

      <Step
        n={5}
        id="export"
        title="Export"
        hint="Each format downloads as soon as it finishes rendering."
        active={ready || workspaceSource !== null}
      >
        {ready ? (
          <ExportHub
            trimSize={settings.trimSize}
            exporting={exporting}
            error={exportError}
            lastExport={lastExport}
            onExport={handleExport}
          />
        ) : workspaceSource !== null ? (
          /*
           * A reopened book. Exporting needs the language, script and text
           * direction the analyzer detects, and a book row does not store them
           * — so this is a real limitation, not a missing upload. The edits are
           * not at risk: re-uploading keeps them (see `workspaceSource`).
           */
          <Notice>
            Upload the original file again to enable export. It is what tells
            the renderer the language, script and text direction — none of which
            a saved book stores. Your edits are kept.
          </Notice>
        ) : (
          <Notice>Analyze a manuscript to enable export.</Notice>
        )}
      </Step>

      {/*
        Mounted at the end of the workspace rather than inside a step: all three
        are overlays over the book, and the editor underneath keeps its state —
        which is the point of a drawer over a page.
      */}
      {activeId ? (
        <CommentsDrawer
          open={commentsOpen}
          onClose={() => setCommentsOpen(false)}
          manuscriptId={activeId}
          chapters={workspaceSource?.chapters ?? openProject?.chapters ?? []}
          role={role}
        />
      ) : null}

      {activeId ? (
        <CoverDrawer
          open={coverOpen}
          onClose={() => setCoverOpen(false)}
          manuscriptId={activeId}
          trimSize={settings.trimSize}
          pageCount={estimatedPages(
            analysis?.word_count ?? openProject?.word_count ?? 0,
          )}
          paper={paper}
          onPaperChange={setPaper}
          onValidated={(_validation, checked) => setCoverFile(checked)}
        />
      ) : null}

      {/*
        The modal is rendered only while it is open, so `withContent` — which
        joins and counts the whole manuscript — runs on the renders that need it
        rather than on every keystroke in the editor beside it.
      */}
      {signOffOpen && activeId && draft ? (
        <ApprovalModal
          open
          onClose={() => setSignOffOpen(false)}
          inputs={{
            manuscriptId: activeId,
            title: draft.title,
            author: draft.author,
            genre: draft.genre,
            trimSize: settings.trimSize,
            scriptType: analysis?.script_type ?? "latin",
            textDirection: analysis?.text_direction ?? "ltr",
            language: draft.language ?? "en",
            customFont: draft.font_family,
            fontSize: draft.font_size,
            paper,
            text: withContent(draft).content ?? "",
            file,
            cover: coverFile,
            analysis,
            chapters: draft.chapters,
            wordCount: draft.word_count,
            coverAsset,
          }}
        />
      ) : null}
    </div>
  );
}
