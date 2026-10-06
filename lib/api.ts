import { createClient } from "./supabase/client";
import { isSupabaseConfigured } from "./supabase/env";
import type {
  BookAnalysis,
  ExportFormat,
  ExportSettings,
  Genre,
  HealthJobAccepted,
  HealthJobStatus,
} from "./types";

/** Extensions the backend's extractors accept. */
export const ACCEPTED_EXTENSIONS = [".docx", ".epub", ".md", ".txt"] as const;

export function hasAcceptedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * FastAPI puts a string in `detail` for HTTPException but an array of field
 * errors in it for a 422, so both shapes have to be read.
 */
async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    const detail = (body as { detail?: unknown } | null)?.detail;

    if (typeof detail === "string" && detail.trim()) return detail;

    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) =>
          typeof (item as { msg?: unknown })?.msg === "string"
            ? (item as { msg: string }).msg
            : JSON.stringify(item),
        )
        .filter(Boolean);
      if (messages.length) return messages.join("; ");
    }
  } catch {
    // Not JSON — fall through to the status line.
  }

  if (response.status === 503) {
    return "The server cannot produce that format because a library it needs is not installed.";
  }
  return `Request failed (${response.status} ${response.statusText || "error"}).`;
}

/**
 * The caller's Supabase access token, when there is a session to speak of.
 *
 * Sent on the routes the backend meters, so an analysis is charged to the
 * account that asked for it. The header is omitted entirely rather than sent
 * empty when there is no session: the backend reads a missing header as
 * "authentication is switched off" and an empty one as a malformed attempt, and
 * those deserve opposite answers.
 */
async function authHeader(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured) return {};
  try {
    const {
      data: { session },
    } = await createClient().auth.getSession();
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};
  } catch {
    // An unreadable session is the same as none here. The request still goes —
    // if the backend is metering it will answer 401, which is the honest
    // outcome, rather than the browser inventing a failure of its own.
    return {};
  }
}

export async function analyzeBook(file: File): Promise<BookAnalysis> {
  const body = new FormData();
  body.append("file", file);
  // Ask for the extracted text back so typo corrections can be applied and sent
  // to the export endpoint, rather than uploading the manuscript a second time.
  body.append("include_text", "true");

  const response = await fetch("/api/analyze-book", {
    method: "POST",
    body,
    headers: await authHeader(),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as BookAnalysis;
}

export interface HealthAnalysisArgs {
  /**
   * Preferred: the text already returned by `analyzeBook`. Pass this rather
   * than the file so a novel is not uploaded a second time just to have it
   * scanned.
   */
  text?: string | null;
  /** Used when the text is not to hand. */
  file?: File | null;
  title?: string;
  author?: string;
  genre?: Genre;
  manuscriptId?: string;
  /** Ids of findings the author has already dismissed, so a re-run does not
   * ask the same question twice. */
  ignored?: string[];
}

/**
 * Start a health scan and return the job to poll.
 *
 * The scan is slow — it calls a model once per chunk of the book — and it costs
 * money, so it does not run inside this request. The backend returns a job id
 * immediately and the work happens in the background; poll it with `readHealth`
 * until `status` leaves "queued"/"running".
 */
export async function startHealthAnalysis({
  text,
  file,
  title,
  author,
  genre,
  manuscriptId,
  ignored,
}: HealthAnalysisArgs): Promise<HealthJobAccepted> {
  const body = new FormData();

  if (text && text.trim()) {
    body.append("text", text);
  } else if (file) {
    body.append("file", file);
  } else {
    throw new Error("There is no manuscript to analyze.");
  }

  if (title?.trim()) body.append("title", title.trim());
  if (author?.trim()) body.append("author", author.trim());
  if (genre) body.append("genre", genre);
  if (manuscriptId) body.append("manuscript_id", manuscriptId);
  for (const id of ignored ?? []) body.append("ignored", id);

  const response = await fetch("/api/manuscript/analyze", {
    method: "POST",
    body,
    headers: await authHeader(),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as HealthJobAccepted;
}

/**
 * Read one health scan. Pair with `startHealthAnalysis`.
 *
 * A scan belonging to another account comes back 404, not 403, so this cannot
 * be used to test whether a job id is real.
 */
export async function readHealth(jobId: string): Promise<HealthJobStatus> {
  const response = await fetch(
    `/api/manuscript/health/${encodeURIComponent(jobId)}`,
    { headers: await authHeader() },
  );
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as HealthJobStatus;
}

function filenameFrom(response: Response, fallback: string): string {
  const header = response.headers.get("content-disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  if (!match) return fallback;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export interface ExportArgs {
  /** Preferred: the text, with any accepted typo corrections applied. */
  text?: string | null;
  /** Fallback for when the backend did not return the text. */
  file?: File | null;
  analysis: BookAnalysis;
  settings: ExportSettings;
  format: ExportFormat;
}

export async function exportBook({
  text,
  file,
  analysis,
  settings,
  format,
}: ExportArgs): Promise<string> {
  const body = new FormData();

  if (text && text.trim()) {
    body.append("text", text);
  } else if (file) {
    body.append("file", file);
  } else {
    throw new Error("There is no manuscript to export.");
  }

  body.append("format", format);
  body.append("genre", settings.genre);
  body.append("trim_size", settings.trimSize);
  body.append("script_type", analysis.script_type);
  body.append("text_direction", analysis.text_direction);
  body.append("language", analysis.detected_language);
  body.append("title", settings.title.trim() || "Untitled");
  if (settings.author.trim()) body.append("author", settings.author.trim());
  if (settings.customFont.trim()) body.append("custom_font", settings.customFont.trim());
  if (settings.fontSize) body.append("font_size", String(settings.fontSize));

  const response = await fetch("/api/export-book", { method: "POST", body });
  if (!response.ok) throw new Error(await readError(response));

  const blob = await response.blob();
  const fallback = `${settings.title.trim() || "book"}.${format}`;
  const filename = filenameFrom(response, fallback);
  saveBlob(blob, filename);
  return filename;
}
