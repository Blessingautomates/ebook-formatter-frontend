"use client";

import { BookWorkspace } from "@/components/book/BookWorkspace";

/**
 * Starting a new book.
 *
 * This is the upload-and-analyze half of the workflow the dashboard used to
 * hold. The workspace is mounted with no record, so it seeds from the file
 * rather than from a saved row.
 *
 * Saving deliberately does not navigate away. The workspace holds the analysis
 * — the language, script and text direction the export needs — and a route
 * change to /dashboard/books/[id] would remount it with only the stored row,
 * which does not carry those. Exporting immediately after saving is the normal
 * thing to want, so the URL stays put; the workspace turns its own save button
 * into an update after the first write (see `activeId`).
 */
export default function NewBookPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
      <BookWorkspace record={null} />
    </div>
  );
}
