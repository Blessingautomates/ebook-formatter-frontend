"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Dropzone } from "@/components/Dropzone";
import { StoryBiblePanel } from "@/components/continuity/StoryBiblePanel";
import { FindingsList } from "@/components/intelligence/FindingsList";
import { Notice, Spinner } from "@/components/primitives";
import { VoiceGuardPanel } from "@/components/voice/VoiceGuardPanel";
import {
  readHealth,
  readIntelligence,
  startHealthAnalysis,
  startStoryBible,
  startVoiceCheck,
  startVoiceProfile,
  type IntelligenceArgs,
} from "@/lib/api";
import {
  getManuscript,
  listManuscripts,
  RECENT_PROJECT_LIMIT,
  type ManuscriptRecord,
} from "@/lib/manuscripts";
import { isSupabaseConfigured, SUPABASE_SETUP_HINT } from "@/lib/supabase/env";
import type {
  HealthReport,
  JobKind,
  StoryBible,
  VoiceCheck,
  VoiceProfile,
} from "@/lib/types";
import { listVoiceChecks, type VoiceCheckRow } from "@/lib/voiceChecks";

/**
 * Manuscript intelligence.
 *
 * One screen for the three passes that read a whole book rather than a line of
 * it: the author's Writing DNA and whether a later draft still matches it, the
 * story bible and the places it contradicts itself, and the Book Doctor's
 * findings, which until now had no surface at all.
 *
 * A pass runs on either the stored text of a saved book or a file dropped on
 * this page. Passing the book's id is what makes a result stick — without it
 * the answer comes back and is thrown away when the tab closes — so the page
 * says which of the two is happening rather than leaving it to be guessed.
 */

/** The three passes, and the poll that runs after each. */
type Running = { kind: JobKind; label: string; stage: string; progress: number };

const POLL_INTERVAL_MS = 1200;
const POLL_CEILING_MS = 10 * 60 * 1000;

function IntelligenceView() {
  const params = useSearchParams();
  const requestedId = params.get("book");

  const [books, setBooks] = useState<ManuscriptRecord[]>([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [booksError, setBooksError] = useState<string | null>(null);

  const [record, setRecord] = useState<ManuscriptRecord | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const [profile, setProfile] = useState<VoiceProfile | null>(null);
  const [bible, setBible] = useState<StoryBible | null>(null);
  const [check, setCheck] = useState<VoiceCheck | null>(null);
  const [history, setHistory] = useState<VoiceCheckRow[]>([]);
  const [report, setReport] = useState<HealthReport | null>(null);

  const [running, setRunning] = useState<Running | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  // The picker. Every saved book, newest first, so the one just worked on is at
  // the top of the list rather than behind a search.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setBooksError(SUPABASE_SETUP_HINT);
      setBooksLoading(false);
      return;
    }
    let live = true;
    void (async () => {
      try {
        const found = await listManuscripts(RECENT_PROJECT_LIMIT);
        if (!live) return;
        setBooks(found);
      } catch (caught) {
        if (!live) return;
        setBooksError(
          caught instanceof Error && caught.message
            ? caught.message
            : "Your books could not be loaded.",
        );
      } finally {
        if (live) setBooksLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const loadBook = useCallback(async (id: string) => {
    setError(null);
    try {
      const found = await getManuscript(id);
      if (cancelled.current) return;
      setRecord(found);
      setProfile(found?.voice_profile ?? null);
      setBible(found?.story_bible ?? null);
      setCheck(null);
      setReport(null);
      setFile(null);
      setHistory(found ? await listVoiceChecks(found.id) : []);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "That book could not be loaded.",
      );
    }
  }, []);

  // A book named in the URL is loaded once the list arrives, so a link from the
  // workspace lands on that book rather than on an empty picker.
  useEffect(() => {
    if (requestedId) void loadBook(requestedId);
  }, [requestedId, loadBook]);

  /**
   * The text a pass runs on: the saved manuscript, or the dropped file.
   *
   * Null when neither exists, which is what disables the buttons — the page
   * never sends an empty string to the API and calls the resulting failure a
   * server problem.
   */
  const text = record?.content ?? null;
  const canRun = Boolean(text && text.trim()) || file !== null;

  const args = useMemo<IntelligenceArgs>(
    () => ({
      text,
      file,
      title: record?.title,
      author: record?.author ?? undefined,
      genre: record?.genre,
      manuscriptId: record?.id,
    }),
    [text, file, record],
  );

  /**
   * Start a pass and follow it to the end.
   *
   * The backend answers 202 with a job id and does the work in the background,
   * so this polls until the status leaves queued/running. "stale" is a real
   * answer rather than an error: the worker is in-process, so a job orphaned by
   * a restart reads as stale and is worth saying plainly instead of spinning.
   */
  const run = useCallback(
    async (
      label: string,
      start: () => Promise<{ job_id: string }>,
      finish: (payload: Record<string, unknown> | null) => void,
    ) => {
      setError(null);
      try {
        const accepted = await start();
        const deadline = Date.now() + POLL_CEILING_MS;

        for (;;) {
          if (cancelled.current) return;
          const status =
            label === "Book Doctor scan"
              ? await readHealth(accepted.job_id)
              : await readIntelligence(accepted.job_id);

          if (status.status === "succeeded") {
            finish(
              label === "Book Doctor scan"
                ? { report: status.report }
                : status.payload,
            );
            return;
          }
          if (status.status === "failed") {
            throw new Error(status.error || "The pass did not finish.");
          }
          if (status.status === "stale" || Date.now() > deadline) {
            throw new Error(
              "That pass stopped before it finished — the background worker does not survive a server restart. Start it again.",
            );
          }

          setRunning({
            kind: status.kind,
            label,
            stage: status.stage ?? "queued",
            progress: status.progress,
          });
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      } catch (caught) {
        setError(
          caught instanceof Error && caught.message
            ? caught.message
            : "That pass could not be started.",
        );
      } finally {
        if (!cancelled.current) setRunning(null);
      }
    },
    [],
  );

  const measureVoice = useCallback(
    () =>
      run(
        "Writing DNA",
        () => startVoiceProfile(args),
        (payload) => setProfile(payload as unknown as VoiceProfile),
      ),
    [args, run],
  );

  const buildBible = useCallback(
    () =>
      run(
        "Story bible",
        () => startStoryBible(args),
        (payload) => setBible(payload as unknown as StoryBible),
      ),
    [args, run],
  );

  const checkVoice = useCallback(() => {
    if (!record) return Promise.resolve();
    return run(
      "Voice check",
      () => startVoiceCheck({ ...args, manuscriptId: record.id }),
      (payload) => {
        setCheck(payload as unknown as VoiceCheck);
        void listVoiceChecks(record.id).then((rows) => {
          if (!cancelled.current) setHistory(rows);
        });
      },
    );
  }, [args, record, run]);

  const doctorScan = useCallback(
    () =>
      run(
        "Book Doctor scan",
        () => startHealthAnalysis(args),
        (payload) => setReport((payload as { report: HealthReport | null }).report),
      ),
    [args, run],
  );

  const busy = running !== null;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 lg:px-8">
      <header>
        <h1 className="font-serif text-2xl font-semibold">
          Manuscript Intelligence
        </h1>
        <p className="mt-1 text-sm text-muted">
          Your voice, your characters, and the places your book disagrees with
          itself.
        </p>
      </header>

      <section className="card space-y-3 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <label className="label" htmlFor="intelligence-book">
              Book
            </label>
            {booksLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Spinner /> Loading your books…
              </p>
            ) : (
              <select
                id="intelligence-book"
                className="field max-w-md"
                value={record?.id ?? ""}
                onChange={(event) => {
                  const id = event.target.value;
                  if (id) void loadBook(id);
                  else {
                    setRecord(null);
                    setProfile(null);
                    setBible(null);
                    setCheck(null);
                    setReport(null);
                    setHistory([]);
                  }
                }}
              >
                <option value="">Choose a book, or drop a file below</option>
                {books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title}
                  </option>
                ))}
              </select>
            )}
          </div>
          {record ? (
            <Link
              href={`/dashboard/books/${record.id}`}
              className="btn btn-sm"
            >
              Open in the workspace
            </Link>
          ) : null}
        </div>

        {booksError ? <Notice tone="error">{booksError}</Notice> : null}

        {record && !text ? (
          <Notice tone="warn">
            This book was saved without its text — the editor was never opened
            for it. Drop the manuscript below and the passes will run against
            the file; the results are still saved to the book.
          </Notice>
        ) : null}

        {!record ? (
          <Dropzone
            file={file}
            busy={busy}
            error={null}
            onFile={(chosen) => setFile(chosen)}
            onInvalid={(message) => setError(message)}
            onReset={() => setFile(null)}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void measureVoice()}
            disabled={busy || !canRun}
          >
            {profile ? "Re-measure my voice" : "Measure my voice"}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void buildBible()}
            disabled={busy || !canRun}
          >
            {bible ? "Rebuild the story bible" : "Build the story bible"}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void checkVoice()}
            disabled={busy || !canRun || !profile || !record}
            title={
              record
                ? profile
                  ? undefined
                  : "Measure the voice first — the check compares against it."
                : "Save the book first, so the profile has somewhere to live."
            }
          >
            Check the voice
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void doctorScan()}
            disabled={busy || !canRun}
          >
            {report ? "Re-run the Book Doctor" : "Run the Book Doctor"}
          </button>
        </div>

        {running ? (
          <div className="space-y-1.5">
            <p className="flex items-center gap-2 text-sm text-muted">
              <Spinner />
              {running.label} — {running.stage} ({running.progress}%)
            </p>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-valuenow={running.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={running.label}
            >
              <div
                className="h-full bg-accent transition-[width]"
                style={{ width: `${running.progress}%` }}
              />
            </div>
          </div>
        ) : null}

        {error ? <Notice tone="error">{error}</Notice> : null}
      </section>

      <VoiceGuardPanel
        profile={profile}
        check={check}
        history={history}
        busy={busy}
        error={null}
        onGenerateProfile={() => void measureVoice()}
        onRunCheck={() => void checkVoice()}
        canCheck={Boolean(record && profile && canRun)}
        checkNote={
          !record
            ? "Save this book first, so the profile has somewhere to live."
            : !profile
              ? "Measure the voice first — the check compares against that profile."
              : !canRun
                ? "There is no text to check yet."
                : null
        }
      />

      <StoryBiblePanel
        bible={bible}
        busy={busy}
        error={null}
        onGenerate={() => void buildBible()}
        bookId={record?.id ?? null}
        canGenerate={canRun}
        note={canRun ? null : "There is no manuscript text to read yet."}
      />

      <section className="card space-y-3 p-5">
        <header>
          <h2 className="font-serif text-base font-semibold">Book Doctor</h2>
          <p className="mt-0.5 text-sm text-muted">
            The full scan: mechanics, prose, structure, continuity and plot, each
            with the line it was found on.
          </p>
        </header>
        <FindingsList
          categories={report?.categories ?? []}
          emptyNote="No scan has been run yet. The Book Doctor reads the whole book, so it takes a few minutes."
        />
      </section>
    </div>
  );
}

/**
 * `useSearchParams` is what lets a link from the workspace open this page on
 * the book it came from, and in the App Router that hook has to sit under a
 * Suspense boundary or the whole route is deopted out of static prerendering
 * and `next build` fails. The boundary lives here rather than in the dashboard
 * layout so it covers this one hook instead of every route under /dashboard.
 *
 * The fallback matches the page's own container so nothing shifts when the real
 * content takes over.
 */
export default function IntelligencePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
          <p className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> Loading manuscript intelligence…
          </p>
        </div>
      }
    >
      <IntelligenceView />
    </Suspense>
  );
}
