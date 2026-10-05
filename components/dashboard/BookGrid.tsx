"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Notice, Spinner } from "@/components/primitives";
import { PlusIcon } from "@/components/shell/icons";
import { useWorkspace } from "@/components/shell/workspace-context";
import {
  deleteManuscript,
  listManuscripts,
  type ManuscriptRecord,
} from "@/lib/manuscripts";
import { isSupabaseConfigured, SUPABASE_SETUP_HINT } from "@/lib/supabase/env";

import { BookCard } from "./BookCard";

/**
 * The author's books, as a grid.
 *
 * Replaces the vertical project list the dashboard used to show. The reads are
 * the same `listManuscripts` the old panel used — what changed is the layout,
 * and that the list is now the page rather than a panel beside it.
 */
export function BookGrid() {
  const [books, setBooks] = useState<ManuscriptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Kept so a failed delete can say which book it was. */
  const [deleting, setDeleting] = useState<string | null>(null);
  /** Which workspace the grid is scoped to; null while the list is loading. */
  const { active } = useWorkspace();
  const workspaceId = active?.workspace.id ?? null;

  const load = useCallback(async (): Promise<void> => {
    if (!isSupabaseConfigured) {
      setError(SUPABASE_SETUP_HINT);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setBooks(await listManuscripts(50, workspaceId));
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "Your books could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(id: string): Promise<void> {
    const book = books.find((item) => item.id === id);
    const name = book?.title.trim() || "this book";
    // Confirmed because there is no undo: the row carries the edited
    // manuscript, and deleting it discards that text.
    if (!window.confirm(`Delete “${name}”? This cannot be undone.`)) return;

    setDeleting(id);
    setError(null);
    try {
      await deleteManuscript(id);
      setBooks((current) => current.filter((item) => item.id !== id));
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "That book could not be deleted.",
      );
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <div
            key={key}
            aria-hidden
            className="card h-80 animate-pulse bg-surface-2/60"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {deleting ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner /> Deleting…
        </p>
      ) : null}

      {books.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="grid size-11 place-items-center rounded-full border border-line bg-surface-2 text-accent">
            <PlusIcon />
          </span>
          <h2 className="font-serif text-lg font-semibold">No books yet</h2>
          <p className="max-w-sm text-sm text-muted">
            Upload a manuscript and ToolStackAI measures it, checks the spelling
            against its language, and renders print-ready files in the trim size
            you choose.
          </p>
          <Link href="/dashboard/books/new" className="btn btn-primary mt-1">
            Create your first book
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {books.map((book) => (
            <BookCard
              key={book.id}
              record={book}
              onDelete={(id) => void handleDelete(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
