"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AdvancedSettings } from "@/components/AdvancedSettings";
import { AnalysisDashboard } from "@/components/AnalysisDashboard";
import { Dropzone } from "@/components/Dropzone";
import { ExportHub } from "@/components/ExportHub";
import { GenreSelector } from "@/components/GenreSelector";
import { ProjectsPanel } from "@/components/ProjectsPanel";
import { TypoDrawer } from "@/components/TypoDrawer";
import {
  ManuscriptWorkspace,
  type EditorState,
} from "@/components/editor/ManuscriptWorkspace";
import { Notice, Step } from "@/components/primitives";
import { analyzeBook, exportBook } from "@/lib/api";
import {
  chaptersFromMarkdown,
  countChapters,
  countWords,
  joinChapters,
} from "@/lib/editorContent";
import {
  RECENT_PROJECT_LIMIT,
  deleteManuscript,
  listManuscripts,
  saveManuscript,
  type ManuscriptDraft,
  type ManuscriptRecord,
} from "@/lib/manuscripts";
import { createClient } from "@/lib/supabase/client";
import { applyFixes, buildRows, type Decision, type Decisions } from "@/lib/typos";
import type { BookAnalysis, ExportFormat, ExportSettings } from "@/lib/types";

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

export default function DashboardPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<BookAnalysis | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const [decisions, setDecisions] = useState<Decisions>({});
  const [typosOpen, setTyposOpen] = useState(false);

  const [settings, setSettings] = useState<ExportSettings>(INITIAL_SETTINGS);
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

  // ---- saved projects ----
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [projects, setProjects] = useState<ManuscriptRecord[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  /** The saved row this session is editing, if any. Null means "a new one". */
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  /**
   * The lists are read in the browser rather than on the server so this stays a
   * client component, the same as the rest of the page. Middleware has already
   * established that there is a session, so `getUser` here is for the address to
   * display, not for a decision.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const {
          data: { user },
        } = await createClient().auth.getUser();
        if (cancelled) return;
        setEmail(user?.email ?? null);

        const rows = await listManuscripts();
        if (!cancelled) setProjects(rows);
      } catch (caught) {
        if (!cancelled) {
          setProjectsError(
            messageFor(caught, "Your projects could not be loaded."),
          );
        }
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    })();

    // Without this, signing out mid-fetch would set state on a gone component.
    return () => {
      cancelled = true;
    };
  }, []);

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
    // insert rather than overwrite the project that was open.
    setActiveId(null);
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

  const openProject =
    projects.find((project) => project.id === activeId) ?? null;

  /**
   * What the editor should be showing, or null when there is nothing to edit.
   *
   * A reopened project with stored text wins even once a fresh analysis has
   * arrived, and the two are not interchangeable. The analyzer supplies the
   * language, script and text direction the export needs — none of which are
   * stored with a project — so reopening one means uploading the original file
   * again. Re-seeding the editor from that upload would discard the very edits
   * the project was reopened for, so the stored text stays and the analysis is
   * used only for what it alone knows. Its key is the project id, which is why
   * the analysis landing does not remount the editor.
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
    return {
      ...base,
      content,
      chapters,
      chapter_count: countChapters(chapters),
      word_count: countWords(content),
    };
  }

  /**
   * The row to write, or null when there is nothing to write yet.
   *
   * Measurements come from the live analysis when there is one. Falling back to
   * the opened project's stored numbers is what lets someone reopen a saved
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
  }, [analysis, openProject, settings]);

  async function handleSave(): Promise<void> {
    if (!draft || saving) return;
    const updating = activeId !== null;
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    try {
      const saved = await saveManuscript(withContent(draft), activeId);
      setActiveId(saved.id);
      setProjects((current) =>
        [saved, ...current.filter((project) => project.id !== saved.id)].slice(
          0,
          RECENT_PROJECT_LIMIT,
        ),
      );
      setSaveNotice(`${updating ? "Updated" : "Saved"} “${saved.title}”.`);
    } catch (caught) {
      setSaveError(messageFor(caught, "The project could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  function handleOpenProject(record: ManuscriptRecord): void {
    setActiveId(record.id);
    setSettings({
      title: record.title,
      // Author is stored because it is part of the exported title page, not
      // just a label on the row.
      author: record.author ?? "",
      genre: record.genre,
      trimSize: record.trim_size,
      customFont: record.font_family ?? "",
      fontSize: record.font_size,
    });
    /*
     * The stored row is not an analysis — it has no language, script or typeset
     * page count — so it cannot stand in for one without the export reading
     * fields that were never saved. Clearing the live analysis is what keeps
     * the panel and the steps below describing the same book.
     */
    setFile(null);
    setAnalysis(null);
    setDecisions({});
    setEditorState(null);
    setTyposOpen(false);
    setStatus("idle");
    setError(null);
    setExporting(null);
    setExportError(null);
    setLastExport(null);
    setSaveError(null);
    /*
     * Whether the manuscript itself came back depends on whether it was ever
     * saved from the editor. A project saved from the upload flow alone stores
     * settings and measurements only, so it still needs its file re-uploaded to
     * be exported.
     */
    setSaveNotice(
      record.content
        ? `Opened “${record.title}”. Upload the original file again to export it — your edits are kept.`
        : `Opened “${record.title}”. Upload the manuscript again to export it.`,
    );
  }

  async function handleDeleteProject(record: ManuscriptRecord): Promise<void> {
    const confirmed = window.confirm(
      `Delete “${record.title}”? This cannot be undone.`,
    );
    if (!confirmed) return;

    setSaveError(null);
    setSaveNotice(null);
    try {
      await deleteManuscript(record.id);
      setProjects((current) =>
        current.filter((project) => project.id !== record.id),
      );
      if (activeId === record.id) setActiveId(null);
      setSaveNotice(`Deleted “${record.title}”.`);
    } catch (caught) {
      setSaveError(messageFor(caught, "The project could not be deleted."));
    }
  }

  async function handleSignOut(): Promise<void> {
    try {
      await createClient().auth.signOut();
    } catch {
      // Leaving the page is what the user asked for. A failed token revoke
      // should not strand them on a page they are trying to leave; the cookie
      // is cleared locally either way.
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            <Link href="/" className="transition-colors hover:text-accent">
              Ebook Formatter
            </Link>
          </h1>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-medium text-muted transition-colors hover:text-accent"
            >
              ← Home
            </Link>
            <span className="font-mono text-xs text-faint">
              format.toolstackai.xyz
            </span>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Upload a manuscript to measure it, review the spelling findings, pick a
          genre, then export a print-ready PDF or convert to EPUB, DOCX, RTF or
          TXT.
        </p>
      </header>

      <div className="mb-5">
        <ProjectsPanel
          email={email}
          projects={projects}
          loading={projectsLoading}
          loadError={projectsError}
          activeId={activeId}
          onOpen={handleOpenProject}
          onDelete={handleDeleteProject}
          onSignOut={handleSignOut}
          onSave={handleSave}
          saving={saving}
          canSave={draft !== null && !saving}
          saveLabel={activeId ? "Save changes" : "Save this manuscript"}
          saveError={saveError}
          saveNotice={saveNotice}
        />
      </div>

      <div className="space-y-5">
        <Step
          n={1}
          title="Manuscript"
          hint="A .docx, .md or .txt file."
          aside={
            file && status === "ready" ? (
              <button type="button" className="btn btn-sm" onClick={reset}>
                Start over
              </button>
            ) : null
          }
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
              Analyze a manuscript — or open a saved project that has one stored
              — to edit it here. Edits become the text the export renders.
            </Notice>
          )}
        </Step>

        <Step
          n={4}
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
             * A reopened project. Exporting needs the language, script and text
             * direction the analyzer detects, and a project row does not store
             * them — so this is a real limitation, not a missing upload. The
             * edits are not at risk: re-uploading keeps them (see
             * `workspaceSource`).
             */
            <Notice>
              Upload the original file again to enable export. It is what tells
              the renderer the language, script and text direction — none of
              which a saved project stores. Your edits are kept.
            </Notice>
          ) : (
            <Notice>Analyze a manuscript to enable export.</Notice>
          )}
        </Step>
      </div>

      <footer className="mt-10 border-t border-line pt-5 text-xs leading-relaxed text-faint">
        Requests go to the FastAPI backend through this app&rsquo;s{" "}
        <code className="font-mono">/api</code> proxy, so the manuscript is
        analysed and rendered server-side. A format is unavailable if its
        renderer is not installed on the server; the error names the missing
        package.
      </footer>
    </main>
  );
}
