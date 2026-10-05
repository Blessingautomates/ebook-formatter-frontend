"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Notice, Spinner } from "@/components/primitives";
import { ChatIcon, CheckIcon, CloseIcon } from "@/components/shell/icons";
import {
  createComment,
  deleteComment,
  listComments,
  setCommentStatus,
  threadComments,
  type BookComment,
  type CommentStatus,
  type CommentThread,
} from "@/lib/comments";
import type { ChapterSummary } from "@/lib/types";
import {
  canApprove,
  canComment,
  ROLE_LABELS,
  type WorkspaceRole,
} from "@/lib/workspaces";

/** "2026-10-04T09:12:00Z" as "4 Oct, 09:12". */
const STAMP = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function authorName(email: string | null): string {
  if (!email) return "A collaborator";
  return email.split("@")[0].replace(/[._+-]+/g, " ");
}

/**
 * The status pill on a comment.
 *
 * Unresolved and resolved are made visually distinct rather than only labelled:
 * an open query is the thing the drawer exists to surface, so it carries the
 * accent and a solid border while everything cleared recedes. Colour alone is
 * not the signal — the word is there too.
 */
function StatusPill({ status }: { status: CommentStatus }) {
  const style =
    status === "open"
      ? "border-accent bg-accent-soft text-accent"
      : status === "approved"
        ? "border-ok bg-ok-soft text-ok"
        : "border-line bg-surface-2 text-muted";

  const label =
    status === "open" ? "Unresolved" : status === "approved" ? "Approved" : "Resolved";

  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase ${style}`}
    >
      {label}
    </span>
  );
}

function RoleBadge({ role }: { role: WorkspaceRole }) {
  return (
    <span className="shrink-0 rounded border border-line bg-surface px-1.5 py-0.5 text-[0.6rem] tracking-wide text-muted uppercase">
      {ROLE_LABELS[role]}
    </span>
  );
}

/**
 * One comment, and the actions on it.
 *
 * The reply box is inline rather than a modal: a review reads as a conversation
 * and a modal would hide the comment being answered.
 */
function CommentRow({
  comment,
  role,
  isReply,
  mayComment,
  mayApprove,
  onReply,
  onStatus,
  onDelete,
  busy,
}: {
  comment: BookComment;
  role: WorkspaceRole;
  isReply?: boolean;
  mayComment: boolean;
  mayApprove: boolean;
  onReply: (parentId: string, body: string) => Promise<void>;
  onStatus: (id: string, status: CommentStatus) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  busy: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");

  async function submit(): Promise<void> {
    if (!draft.trim()) return;
    await onReply(comment.parent_id ?? comment.id, draft);
    setDraft("");
    setReplying(false);
  }

  return (
    <div
      className={`rounded-xl border p-3 ${
        comment.status === "open"
          ? "border-accent/40 bg-accent-soft/40"
          : "border-line bg-surface"
      } ${isReply ? "ml-4" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium capitalize">
          {authorName(comment.author_email)}
        </span>
        <RoleBadge role={role} />
        <StatusPill status={comment.status} />
        <span className="ml-auto text-[0.7rem] text-muted">
          {STAMP.format(new Date(comment.created_at))}
        </span>
      </div>

      {comment.chapter_title ? (
        <p className="mt-1.5 text-[0.7rem] text-muted">
          On <span className="text-ink">{comment.chapter_title}</span>
        </p>
      ) : null}

      <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap">
        {comment.body}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {mayComment ? (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setReplying((value) => !value)}
          >
            Reply
          </button>
        ) : null}

        {comment.status !== "resolved" ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={busy}
            onClick={() => void onStatus(comment.id, "resolved")}
          >
            <CheckIcon className="size-3.5" />
            Resolve
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-sm"
            disabled={busy}
            onClick={() => void onStatus(comment.id, "open")}
          >
            Reopen
          </button>
        )}

        {/*
          Approving is the approver's act, not the commenter's — see
          `canApprove`. A proofreader can clear their own query; only an
          approver or the owner can mark the chapter approved.
        */}
        {mayApprove && comment.status !== "approved" ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={busy}
            onClick={() => void onStatus(comment.id, "approved")}
          >
            Approve
          </button>
        ) : null}

        <button
          type="button"
          className="btn btn-sm ml-auto text-danger"
          disabled={busy}
          onClick={() => void onDelete(comment.id)}
        >
          Delete
        </button>
      </div>

      {replying ? (
        <div className="mt-2 space-y-2">
          <textarea
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            placeholder="Reply…"
            aria-label="Reply"
            className="field w-full resize-y"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!draft.trim() || busy}
              onClick={() => void submit()}
            >
              Post reply
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setReplying(false);
                setDraft("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The collaboration drawer.
 *
 * A slide-over rather than a page, because reviewing a manuscript is something
 * done *while* reading it: leaving the editor to read a comment and coming back
 * would lose the place. It sits on top of the workspace and closes back into it.
 *
 * Filtering by unresolved is the default because that is the state with work
 * left in it — a drawer that opened on a wall of resolved notes would bury the
 * three that need an answer.
 */
export function CommentsDrawer({
  open,
  onClose,
  manuscriptId,
  chapters,
  role,
}: {
  open: boolean;
  onClose: () => void;
  manuscriptId: string;
  chapters: ChapterSummary[];
  role: WorkspaceRole;
}) {
  const [comments, setComments] = useState<BookComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [body, setBody] = useState("");
  const [chapter, setChapter] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  const panel = useRef<HTMLDivElement>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setComments(await listComments(manuscriptId));
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "The comments could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [manuscriptId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const threads = useMemo(() => threadComments(comments), [comments]);
  const unresolved = comments.filter((item) => item.status === "open").length;

  const visible = useMemo(() => {
    if (showResolved) return threads;
    // A thread is hidden only when it and every reply to it are cleared.
    return threads.filter(
      (thread) =>
        thread.comment.status === "open" ||
        thread.replies.some((reply) => reply.status === "open"),
    );
  }, [threads, showResolved]);

  const mayComment = canComment(role);
  const mayApprove = canApprove(role);

  async function post(): Promise<void> {
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createComment({
        manuscriptId,
        body,
        chapterTitle: chapter || null,
      });
      setBody("");
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "The comment could not be posted.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function reply(parentId: string, text: string): Promise<void> {
    setBusy(true);
    try {
      await createComment({ manuscriptId, body: text, parentId });
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "The reply could not be posted.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function status(id: string, next: CommentStatus): Promise<void> {
    setBusy(true);
    try {
      await setCommentStatus(id, next);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "The comment could not be updated.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string): Promise<void> {
    setBusy(true);
    try {
      await deleteComment(id);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "The comment could not be deleted.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close comments"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Collaboration comments"
        className="relative flex h-full w-full max-w-lg flex-col border-l border-line bg-paper shadow-2xl"
      >
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <ChatIcon className="size-4 text-accent" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Comments</h2>
            <p className="text-xs text-muted">
              {loading
                ? "Loading…"
                : unresolved === 0
                  ? "Nothing outstanding"
                  : `${unresolved} unresolved`}
            </p>
          </div>
          <RoleBadge role={role} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="btn btn-sm px-2"
          >
            <CloseIcon className="size-4" />
          </button>
        </header>

        <div className="border-b border-line px-4 py-2">
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(event) => setShowResolved(event.target.checked)}
              className="size-3.5 accent-[var(--color-accent)]"
            />
            Show resolved and approved
          </label>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {error ? <Notice tone="error">{error}</Notice> : null}

          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Spinner /> Loading comments…
            </p>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center">
              <p className="text-sm text-muted">
                {comments.length === 0
                  ? "No comments yet. Leave the first note on a chapter."
                  : "Every comment has been resolved."}
              </p>
            </div>
          ) : (
            visible.map((thread: CommentThread) => (
              <div key={thread.comment.id} className="space-y-2">
                <CommentRow
                  comment={thread.comment}
                  role={role}
                  mayComment={mayComment}
                  mayApprove={mayApprove}
                  onReply={reply}
                  onStatus={status}
                  onDelete={remove}
                  busy={busy}
                />
                {thread.replies.map((replyComment) => (
                  <CommentRow
                    key={replyComment.id}
                    comment={replyComment}
                    role={role}
                    isReply
                    mayComment={mayComment}
                    mayApprove={mayApprove}
                    onReply={reply}
                    onStatus={status}
                    onDelete={remove}
                    busy={busy}
                  />
                ))}
              </div>
            ))
          )}
        </div>

        {mayComment ? (
          <div className="space-y-2 border-t border-line px-4 py-3">
            <select
              value={chapter}
              onChange={(event) => setChapter(event.target.value)}
              aria-label="Chapter this comment is about"
              className="field w-full"
            >
              <option value="">Whole manuscript</option>
              {chapters.map((item) => (
                <option key={`${item.title}-${item.line_number}`} value={item.title}>
                  {item.title}
                </option>
              ))}
            </select>

            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
              placeholder="Leave a note for the author…"
              aria-label="New comment"
              className="field w-full resize-y"
            />

            <button
              type="button"
              className="btn btn-primary btn-sm w-full"
              disabled={busy || !body.trim()}
              onClick={() => void post()}
            >
              {busy ? <Spinner /> : null}
              Post comment
            </button>
          </div>
        ) : (
          <div className="border-t border-line px-4 py-3">
            <p className="text-xs text-muted">
              You are here as {ROLE_LABELS[role]}. Only owners, editors and
              proofreaders can comment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
