"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { BookWorkspace } from "@/components/book/BookWorkspace";
import { Notice, Spinner } from "@/components/primitives";
import { getManuscript, type ManuscriptRecord } from "@/lib/manuscripts";
import { isSupabaseConfigured, SUPABASE_SETUP_HINT } from "@/lib/supabase/env";

/**
 * One saved book.
 *
 * Read in the browser rather than on the server: the row is behind row-level
 * security, and the browser client is the one holding the session's token.
 * Fetching it server-side would mean threading the cookie through a second
 * client to get the same answer.
 *
 * A missing row is a not-found state, not an error — see `getManuscript`.
 */
export default function BookPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<ManuscriptRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError(SUPABASE_SETUP_HINT);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const found = await getManuscript(id);
        if (!cancelled) setRecord(found);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error && caught.message
              ? caught.message
              : "This book could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner /> Loading this book…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 lg:px-8">
        <Notice tone="error">{error}</Notice>
        <Link href="/dashboard" className="btn btn-sm">
          Back to your books
        </Link>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 lg:px-8">
        <Notice tone="warn">
          That book is not here. It may have been deleted, or it belongs to
          another account.
        </Notice>
        <Link href="/dashboard" className="btn btn-sm">
          Back to your books
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
      {/*
        Keyed on the id: the workspace seeds its settings and its editor state
        once and ignores later prop changes, so moving between two books has to
        be a remount rather than a prop update.
      */}
      <BookWorkspace key={record.id} record={record} />
    </div>
  );
}
