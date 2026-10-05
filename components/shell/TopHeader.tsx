"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import type { CreditSummary } from "@/lib/credits";
import type { Plan } from "@/lib/subscriptions";

import {
  BellIcon,
  ChevronDownIcon,
  MenuIcon,
  SearchIcon,
  SparkleIcon,
  UserIcon,
} from "./icons";
import { NAV_ITEMS } from "./nav";

export interface HeaderNotification {
  id: string;
  title: string;
  body: string;
  href: string;
}

export interface SearchableBook {
  id: string;
  title: string;
}

/** "blessing@example.com" becomes "BE". */
function initialsFrom(email: string | null): string {
  if (!email) return "?";
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  const letters = (parts.length > 1 ? [parts[0], parts[1]] : [local.slice(0, 2)])
    .map((part) => part.charAt(0))
    .join("");
  return (letters || local.charAt(0) || "?").toUpperCase();
}

/** A dropdown that closes on an outside click, Escape, or a route change. */
function useDismissable(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return ref;
}

export function TopHeader({
  onOpenSidebar,
  searchRef,
  books,
  notifications,
  email,
  plan,
  credits,
  creditsError,
  onUpgrade,
  onSignOut,
}: {
  onOpenSidebar: () => void;
  /** Owned by the shell, so the sidebar's Search button and `/` can focus it. */
  searchRef: RefObject<HTMLInputElement | null>;
  books: SearchableBook[];
  notifications: HeaderNotification[];
  email: string | null;
  plan: Plan | null;
  credits: CreditSummary | null;
  creditsError: string | null;
  onUpgrade: () => void;
  onSignOut: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  const searchBox = useDismissable(searchOpen, () => setSearchOpen(false));
  const accountMenu = useDismissable(menuOpen, () => setMenuOpen(false));
  const bellMenu = useDismissable(bellOpen, () => setBellOpen(false));

  /*
   * Search covers features and books together. They are different shapes of
   * result, so books are mapped into the same `{href,label,note}` form the nav
   * items already have rather than the render having to branch per section.
   */
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];

    const features = NAV_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(needle) ||
        item.description.toLowerCase().includes(needle),
    ).map((item) => ({
      key: item.href,
      href: item.href,
      label: item.label,
      note: item.description,
      group: "Features",
    }));

    const matchedBooks = books
      .filter((book) => book.title.toLowerCase().includes(needle))
      .slice(0, 6)
      .map((book) => ({
        key: `book:${book.id}`,
        href: `/dashboard/books/${book.id}`,
        label: book.title,
        note: "Open this book",
        group: "Books",
      }));

    return [...matchedBooks, ...features].slice(0, 8);
  }, [query, books]);

  const isPro = plan === "pro";

  const creditPct =
    credits && credits.allowance > 0
      ? Math.min(100, Math.round((credits.balance / credits.allowance) * 100))
      : 0;

  function submitSearch(): void {
    const first = results[0];
    if (!first) return;
    setSearchOpen(false);
    setQuery("");
    router.push(first.href);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open navigation"
          className="rounded-md p-2 text-muted transition-colors hover:text-accent lg:hidden"
        >
          <MenuIcon />
        </button>

        <div ref={searchBox} className="relative min-w-0 flex-1">
          <div className="flex items-center gap-2 rounded-lg border border-control bg-surface-2 px-3 py-2 focus-within:border-accent">
            <SearchIcon className="size-4 text-faint" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitSearch();
              }}
              placeholder="Search your books, projects or features..."
              aria-label="Search your books, projects or features"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
            />
          </div>

          {searchOpen && query.trim() ? (
            <div className="absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
              {results.length === 0 ? (
                <p className="px-3.5 py-3 text-sm text-muted">
                  Nothing matches “{query.trim()}”.
                </p>
              ) : (
                <ul className="max-h-80 overflow-y-auto py-1">
                  {results.map((result) => (
                    <li key={result.key}>
                      <Link
                        href={result.href}
                        onClick={() => {
                          setSearchOpen(false);
                          setQuery("");
                        }}
                        className="flex items-baseline gap-2 px-3.5 py-2 transition-colors hover:bg-surface-2"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {result.label}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {result.note}
                          </span>
                        </span>
                        <span className="chip shrink-0">{result.group}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* ---- AI credits ---- */}
          <div
            className="hidden items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 sm:flex"
            title={
              creditsError
                ? creditsError
                : credits
                  ? `${credits.balance.toLocaleString()} of ${credits.allowance.toLocaleString()} credits left`
                  : "Credits are unavailable."
            }
          >
            <SparkleIcon className="size-4 text-accent" />
            {credits ? (
              <>
                <span className="font-mono text-xs tabular-nums">
                  {credits.balance.toLocaleString()}
                  <span className="text-faint">
                    {" / "}
                    {credits.allowance.toLocaleString()}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="h-1.5 w-14 overflow-hidden rounded-full bg-line"
                >
                  <span
                    className={`block h-full rounded-full ${
                      creditPct > 25
                        ? "bg-accent"
                        : creditPct > 10
                          ? "bg-warn"
                          : "bg-danger"
                    }`}
                    style={{ width: `${Math.max(creditPct, 2)}%` }}
                  />
                </span>
              </>
            ) : (
              <span className="text-xs text-muted">
                {creditsError ? "Credits unavailable" : "Loading credits…"}
              </span>
            )}
          </div>

          {/* ---- notifications ---- */}
          <div ref={bellMenu} className="relative">
            <button
              type="button"
              onClick={() => setBellOpen((open) => !open)}
              aria-label={
                notifications.length
                  ? `Notifications, ${notifications.length} unread`
                  : "Notifications"
              }
              aria-expanded={bellOpen}
              className="relative rounded-md p-2 text-muted transition-colors hover:text-accent"
            >
              <BellIcon />
              {notifications.length > 0 ? (
                <span className="absolute top-1 right-1 size-2 rounded-full bg-danger" />
              ) : null}
            </button>

            {bellOpen ? (
              <div className="absolute right-0 z-40 mt-1.5 w-80 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
                <div className="border-b border-line px-3.5 py-2.5 text-sm font-semibold">
                  Notifications
                </div>
                {notifications.length === 0 ? (
                  <p className="px-3.5 py-4 text-sm text-muted">
                    You&rsquo;re all caught up. Book issues and reviewer activity
                    appear here.
                  </p>
                ) : (
                  <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                    {notifications.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          onClick={() => setBellOpen(false)}
                          className="block px-3.5 py-2.5 transition-colors hover:bg-surface-2"
                        >
                          <span className="block text-sm font-medium">
                            {item.title}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                            {item.body}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          {/* ---- account ---- */}
          <div ref={accountMenu} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label="Account menu"
              className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 py-1 pr-1.5 pl-1 transition-colors hover:border-accent"
            >
              <span
                aria-hidden
                className="grid size-7 place-items-center rounded-md bg-gradient-to-br from-[#e5c158] via-[#d4af37] to-[#b89228] text-[0.7rem] font-bold text-accent-ink"
              >
                {initialsFrom(email)}
              </span>
              <ChevronDownIcon className="size-4 text-muted" />
            </button>

            {menuOpen ? (
              <div className="absolute right-0 z-40 mt-1.5 w-64 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
                <div className="border-b border-line px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <UserIcon className="size-4 text-muted" />
                    <span className="min-w-0 truncate text-sm font-medium">
                      {email ?? "Signed in"}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="chip">
                      {plan === "pro"
                        ? "Pro plan"
                        : plan === "free"
                          ? "Free plan"
                          : "Plan unknown"}
                    </span>
                    {credits ? (
                      <span className="chip">
                        {credits.balance.toLocaleString()} credits
                      </span>
                    ) : null}
                  </div>
                </div>

                <ul className="py-1">
                  <li>
                    <Link
                      href="/dashboard/credits"
                      onClick={() => setMenuOpen(false)}
                      className="block px-3.5 py-2 text-sm transition-colors hover:bg-surface-2"
                    >
                      AI Credits
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setMenuOpen(false)}
                      className="block px-3.5 py-2 text-sm transition-colors hover:bg-surface-2"
                    >
                      Settings
                    </Link>
                  </li>
                </ul>

                <div className="border-t border-line p-2">
                  <button
                    type="button"
                    className="btn btn-sm w-full"
                    onClick={() => {
                      setMenuOpen(false);
                      onUpgrade();
                    }}
                  >
                    {isPro ? "Manage plan" : "Upgrade Plan"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm mt-1.5 w-full"
                    onClick={() => {
                      setMenuOpen(false);
                      onSignOut();
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
