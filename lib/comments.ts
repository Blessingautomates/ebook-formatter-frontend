import { createClient } from "./supabase/client";

/**
 * Data access for chapter comments.
 *
 * A comment is a note about a chapter, and a reply is a comment with a parent.
 * That is the whole model — threads are one level of `parent_id` rather than a
 * separate table, because a reply to a reply is structurally the same thing and
 * a second table would only encode a depth the UI flattens anyway.
 *
 * Comments are visible to whoever can read the book, which the select policy
 * decides from the book's owner and its workspace. Nothing here re-checks that:
 * a query for a book the caller cannot see returns no rows, and the drawer
 * shows an empty thread rather than an error.
 */

export type CommentStatus = "open" | "resolved" | "approved";

export interface BookComment {
  id: string;
  manuscript_id: string;
  parent_id: string | null;
  author_id: string;
  chapter_title: string | null;
  body: string;
  status: CommentStatus;
  created_at: string;
  updated_at: string;
  /** Filled in from `profiles` by `listComments`, or null when unknown. */
  author_email: string | null;
}

/** A top-level comment and its replies, in the order they should be shown. */
export interface CommentThread {
  comment: BookComment;
  replies: BookComment[];
}

const COLUMNS =
  "id,manuscript_id,parent_id,author_id,chapter_title,body,status,created_at,updated_at";

/**
 * Every comment on a book, oldest first.
 *
 * Addresses are fetched in a second query rather than embedded. PostgREST
 * resolves an embed through a foreign key and there is none between
 * `book_comments` and `profiles` — both reference `auth.users` — so an
 * embedded `profiles(email)` would be a relationship PostgREST cannot find.
 */
export async function listComments(
  manuscriptId: string,
): Promise<BookComment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("book_comments")
    .select(COLUMNS)
    .eq("manuscript_id", manuscriptId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Could not load the comments: ${error.message}`);

  const rows = (data ?? []) as unknown as Omit<BookComment, "author_email">[];
  if (rows.length === 0) return [];

  const authorIds = [...new Set(rows.map((row) => row.author_id))];
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, email")
    .in("user_id", authorIds);

  if (profileError) {
    // An address we cannot resolve is not worth failing the thread over; the
    // comment still shows, attributed to the id.
    return rows.map((row) => ({ ...row, author_email: null }));
  }

  const emails = new Map(
    ((profiles ?? []) as unknown as { user_id: string; email: string | null }[]).map(
      (row) => [row.user_id, row.email],
    ),
  );

  return rows.map((row) => ({
    ...row,
    author_email: emails.get(row.author_id) ?? null,
  }));
}

/**
 * Group flat rows into threads.
 *
 * A reply whose parent is missing from the list is treated as a top-level
 * comment rather than dropped. That happens when a parent is deleted and the
 * cascade took the reply with it — but also, benignly, when the reader's page
 * is showing a subset — and losing a comment silently is the worse failure.
 */
export function threadComments(comments: BookComment[]): CommentThread[] {
  const threads: CommentThread[] = [];
  const index = new Map<string, CommentThread>();

  for (const comment of comments) {
    if (comment.parent_id !== null) continue;
    const thread: CommentThread = { comment, replies: [] };
    threads.push(thread);
    index.set(comment.id, thread);
  }

  for (const comment of comments) {
    if (comment.parent_id === null) continue;
    const parentThread = index.get(comment.parent_id);
    if (parentThread) {
      parentThread.replies.push(comment);
      continue;
    }
    // Orphaned reply — its parent is not in this list. Shown as its own thread
    // rather than discarded, because a comment that vanishes silently is a
    // worse failure than one that appears at the wrong level.
    const thread: CommentThread = { comment, replies: [] };
    threads.push(thread);
    index.set(comment.id, thread);
  }

  return threads;
}

export async function createComment({
  manuscriptId,
  body,
  chapterTitle,
  parentId,
}: {
  manuscriptId: string;
  body: string;
  chapterTitle?: string | null;
  parentId?: string | null;
}): Promise<BookComment> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("book_comments")
    .insert({
      manuscript_id: manuscriptId,
      body: body.trim(),
      chapter_title: chapterTitle?.trim() || null,
      parent_id: parentId ?? null,
    })
    .select(COLUMNS)
    .single();

  if (error) throw new Error(`Could not post the comment: ${error.message}`);
  if (!data) throw new Error("Could not post the comment: no row returned.");
  return { ...(data as unknown as Omit<BookComment, "author_email">), author_email: null };
}

/**
 * Resolve, approve or reopen a comment.
 *
 * Anyone who can read the book may change a status, not only its author:
 * clearing a proofreader's query is the whole point of the review, and a note
 * only its author could close would be a note nobody could clear.
 */
export async function setCommentStatus(
  id: string,
  status: CommentStatus,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("book_comments")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(`Could not update the comment: ${error.message}`);
}

export async function deleteComment(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("book_comments").delete().eq("id", id);
  if (error) throw new Error(`Could not delete the comment: ${error.message}`);
}

/** Open, unresolved threads — what "3 unresolved" in the drawer header counts. */
export function unresolvedCount(comments: BookComment[]): number {
  return comments.filter((comment) => comment.status === "open").length;
}
