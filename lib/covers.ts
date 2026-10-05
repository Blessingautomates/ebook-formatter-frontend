import { createClient } from "./supabase/client";
import type { TrimSize } from "./types";

/**
 * Cover validation and cover storage.
 *
 * The measurement happens in the backend — `POST /api/validate-cover` — because
 * it needs to read the image's pixels and its metadata, which a browser can do
 * but only by decoding the whole file. The backend also owns the spine and
 * bleed arithmetic, so there is one implementation rather than two that can
 * disagree about what 300 DPI means.
 *
 * What is stored here is the *result*: the measurements and the verdict. The
 * file itself goes to the private `covers` bucket under the uploader's own
 * folder, which the storage policy enforces.
 */

export type CoverStatus = "pending" | "passed" | "warnings" | "failed";

export interface CoverCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  measured: string;
  required: string;
  message: string;
}

export interface CoverSpecification {
  trim_width_in: number;
  trim_height_in: number;
  spine_width_in: number;
  bleed_in: number;
  safe_area_in: number;
  full_width_in: number;
  full_height_in: number;
  required_width_px: number;
  required_height_px: number;
  page_count: number;
  paper: string;
}

export interface CoverValidation {
  status: Exclude<CoverStatus, "pending">;
  width_px: number;
  height_px: number;
  dpi: number | null;
  specification: CoverSpecification;
  checks: CoverCheck[];
}

export interface CoverAsset {
  id: string;
  manuscript_id: string;
  storage_path: string | null;
  width_px: number | null;
  height_px: number | null;
  dpi: number | null;
  status: CoverStatus;
  checks: CoverCheck[];
  created_at: string;
}

/** The paper stocks the spine calculation understands. */
export type PaperStock = "white" | "cream" | "colour";

export const PAPER_LABELS: Record<PaperStock, string> = {
  white: "White",
  cream: "Cream",
  colour: "Colour",
};

export const ACCEPTED_COVER_TYPES = [
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
] as const;

export const ACCEPTED_COVER_EXTENSIONS = [".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp"] as const;

export function hasCoverExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED_COVER_EXTENSIONS.some((extension) => lower.endsWith(extension));
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
  return `The cover could not be checked (${response.status} ${response.statusText || "error"}).`;
}

/**
 * Send a cover to the backend and get its measurements back.
 *
 * `pageCount` decides the spine width, so it has to be the book's real count —
 * the analyzer's estimate, which is what the row stores.
 */
export async function validateCover(
  file: File,
  {
    trimSize,
    pageCount,
    paper,
  }: { trimSize: TrimSize; pageCount: number; paper: PaperStock },
): Promise<CoverValidation> {
  const body = new FormData();
  body.append("file", file);
  body.append("trim_size", trimSize);
  body.append("page_count", String(Math.max(1, Math.round(pageCount))));
  body.append("paper", paper);

  const response = await fetch("/api/validate-cover", { method: "POST", body });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as CoverValidation;
}

/**
 * Put the file in the `covers` bucket.
 *
 * Path is `<user id>/<manuscript id>/<timestamp>-<name>`: the leading folder is
 * what the storage policy matches on, so a path without it is rejected, and the
 * timestamp stops a re-upload from overwriting the cover it replaces.
 */
export async function uploadCoverFile(
  file: File,
  userId: string,
  manuscriptId: string,
): Promise<string> {
  const supabase = createClient();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${userId}/${manuscriptId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from("covers")
    .upload(path, file, { upsert: false, contentType: file.type || undefined });

  if (error) throw new Error(`Could not store the cover: ${error.message}`);
  return path;
}

export async function saveCoverAsset({
  manuscriptId,
  storagePath,
  validation,
}: {
  manuscriptId: string;
  storagePath: string | null;
  validation: CoverValidation;
}): Promise<CoverAsset> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cover_assets")
    .insert({
      manuscript_id: manuscriptId,
      storage_path: storagePath,
      width_px: validation.width_px,
      height_px: validation.height_px,
      dpi: validation.dpi,
      status: validation.status,
      checks: validation.checks,
    })
    .select("id,manuscript_id,storage_path,width_px,height_px,dpi,status,checks,created_at")
    .single();

  if (error) throw new Error(`Could not save the cover record: ${error.message}`);
  if (!data) throw new Error("Could not save the cover record: no row returned.");
  return data as unknown as CoverAsset;
}

/** The most recent cover for a book, or null when none has been validated. */
export async function latestCoverAsset(
  manuscriptId: string,
): Promise<CoverAsset | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cover_assets")
    .select("id,manuscript_id,storage_path,width_px,height_px,dpi,status,checks,created_at")
    .eq("manuscript_id", manuscriptId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Could not load the cover: ${error.message}`);
  return (data as unknown as CoverAsset) ?? null;
}

/** A signed URL for a private cover, valid for an hour. */
export async function coverPreviewUrl(storagePath: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("covers")
    .createSignedUrl(storagePath, 3600);

  if (error) return null;
  return data?.signedUrl ?? null;
}
