"use client";

import Link from "next/link";

import { BookGrid } from "@/components/dashboard/BookGrid";
import { HeroBanner, ValueProps } from "@/components/dashboard/hero";
import {
  CreditsCard,
  QuickActions,
  SupportLinks,
  UpgradeWidget,
} from "@/components/dashboard/rail";
import { PlusIcon } from "@/components/shell/icons";
import { WorkspaceSwitcher } from "@/components/shell/WorkspaceSwitcher";
import { useWorkspace } from "@/components/shell/workspace-context";

/**
 * The dashboard home.
 *
 * This page used to be the whole five-step workflow. That workflow now lives at
 * /dashboard/books/new and /dashboard/books/[id], because a page that is both
 * "where my books are" and "the editor for the book I happen to have open"
 * cannot show a grid of books *and* be one. What is left here is the overview:
 * the greeting, the grid, and the rail of things an author needs beside it.
 *
 * The rail is a sibling column rather than a right sidebar in the layout,
 * because it belongs to this page and not to the shell — a book's workspace
 * fills the full width.
 */
export default function DashboardPage() {
  const { active, loading } = useWorkspace();

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 lg:px-8">
      <HeroBanner />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <section className="space-y-4">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-serif text-xl font-semibold">My Books</h2>
                <p className="mt-0.5 text-sm text-muted">
                  {loading
                    ? "Loading your workspace…"
                    : active
                      ? `Showing ${active.workspace.name}`
                      : "Your saved manuscripts and their readiness"}
                </p>
              </div>
              <Link href="/dashboard/books/new" className="btn btn-sm">
                <PlusIcon className="size-4" />
                New book
              </Link>
            </header>

            {/*
              The switcher lives here as well as anywhere the shell puts it,
              because this is the list it scopes. Seeing the grid change under
              the control is what makes it clear the choice is a filter.
            */}
            <div className="max-w-sm">
              <WorkspaceSwitcher />
            </div>

            <BookGrid />
          </section>

          <ValueProps />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <CreditsCard />
          <QuickActions />
          <UpgradeWidget />
          <SupportLinks />
        </aside>
      </div>
    </div>
  );
}
