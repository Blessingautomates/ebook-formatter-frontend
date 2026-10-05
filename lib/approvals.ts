import { createClient } from "./supabase/client";

/**
 * Data access for the final publication sign-off.
 *
 * An approval records three separate statements, not one signature. The brief
 * asks for three checkboxes — the manuscript was reviewed, the formatting is
 * approved, the export is approved — and they are stored individually because
 * "I read it" and "I approve the file that will be printed" are different
 * claims. A row that recorded only "signed" could not tell them apart later,
 * which is exactly when it matters.
 */

export interface ApprovalRecord {
  id: string;
  manuscript_id: string;
  user_id: string;
  reviewed_manuscript: boolean;
  approved_formatting: boolean;
  approved_export: boolean;
  signed_at: string | null;
  created_at: string;
}

export const APPROVAL_COLUMNS =
  "id,manuscript_id,user_id,reviewed_manuscript,approved_formatting,approved_export,signed_at,created_at";

/** The caller's own approval, or null when they have not signed. */
export async function getMyApproval(
  manuscriptId: string,
): Promise<ApprovalRecord | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("approvals")
    .select(APPROVAL_COLUMNS)
    .eq("manuscript_id", manuscriptId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(`Could not load the approval: ${error.message}`);
  return (data as unknown as ApprovalRecord) ?? null;
}

/** Every approval on a book, so the modal can show who else has signed. */
export async function listApprovals(
  manuscriptId: string,
): Promise<ApprovalRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("approvals")
    .select(APPROVAL_COLUMNS)
    .eq("manuscript_id", manuscriptId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Could not load the approvals: ${error.message}`);
  return (data ?? []) as unknown as ApprovalRecord[];
}

/**
 * Record the caller's sign-off.
 *
 * `signed_at` is set here rather than defaulted in the table, because a row can
 * legitimately exist with some boxes ticked and no signature — an approval in
 * progress. The signature is the moment all three are true.
 */
export async function saveApproval({
  manuscriptId,
  reviewedManuscript,
  approvedFormatting,
  approvedExport,
}: {
  manuscriptId: string;
  reviewedManuscript: boolean;
  approvedFormatting: boolean;
  approvedExport: boolean;
}): Promise<ApprovalRecord> {
  const supabase = createClient();
  const complete = reviewedManuscript && approvedFormatting && approvedExport;

  const { data, error } = await supabase
    .from("approvals")
    .upsert(
      {
        manuscript_id: manuscriptId,
        reviewed_manuscript: reviewedManuscript,
        approved_formatting: approvedFormatting,
        approved_export: approvedExport,
        signed_at: complete ? new Date().toISOString() : null,
      },
      { onConflict: "manuscript_id,user_id" },
    )
    .select(APPROVAL_COLUMNS)
    .single();

  if (error) throw new Error(`Could not record the approval: ${error.message}`);
  if (!data) throw new Error("Could not record the approval: no row returned.");
  return data as unknown as ApprovalRecord;
}

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
    return "The package could not be built because a library it needs is not installed on the server.";
  }
  return `The package could not be built (${response.status} ${response.statusText || "error"}).`;
}

export interface PackageArgs {
  text: string;
  file?: File | null;
  cover?: File | null;
  title: string;
  author?: string | null;
  genre: string;
  trimSize: string;
  scriptType: string;
  textDirection: string;
  language: string;
  customFont?: string | null;
  fontSize?: number | null;
  pageCount: number;
  paper: string;
  isbn?: string | null;
}

/**
 * Download the complete publishing package.
 *
 * The three checkboxes gate this in the UI, and the manuscript text is what is
 * sent — so the archive contains the edited book, not the uploaded original.
 */
export async function downloadPackage(args: PackageArgs): Promise<string> {
  const body = new FormData();

  if (args.text.trim()) body.append("text", args.text);
  else if (args.file) body.append("file", args.file);
  else throw new Error("There is no manuscript to package.");

  if (args.cover) body.append("cover", args.cover);

  body.append("title", args.title.trim() || "Untitled");
  if (args.author?.trim()) body.append("author", args.author.trim());
  body.append("genre", args.genre);
  body.append("trim_size", args.trimSize);
  body.append("script_type", args.scriptType);
  body.append("text_direction", args.textDirection);
  body.append("language", args.language);
  if (args.customFont?.trim()) body.append("custom_font", args.customFont.trim());
  if (args.fontSize) body.append("font_size", String(args.fontSize));
  body.append("page_count", String(Math.max(1, Math.round(args.pageCount))));
  body.append("paper", args.paper);
  if (args.isbn?.trim()) body.append("isbn", args.isbn.trim());

  const response = await fetch("/api/package-book", { method: "POST", body });
  if (!response.ok) throw new Error(await readError(response));

  const blob = await response.blob();
  const header = response.headers.get("content-disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  const fallback = `${args.title.trim() || "book"}-publishing-package.zip`;
  let filename = fallback;
  if (match) {
    try {
      filename = decodeURIComponent(match[1]);
    } catch {
      filename = match[1];
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);

  return filename;
}
