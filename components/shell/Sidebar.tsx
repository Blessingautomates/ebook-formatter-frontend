"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import type { Plan } from "@/lib/subscriptions";

import { CloseIcon, SearchIcon, SparkleIcon } from "./icons";
import { NAV_ITEMS, isActivePath } from "./nav";

/**
 * The application sidebar: brand, search, navigation and the upgrade CTA.
 *
 * Rendered twice-over in effect — a fixed rail from `lg` up, and an off-canvas
 * drawer below it. It is one component rather than two so the nav can only be
 * defined once; the `lg:` classes decide which of the two is on screen.
 *
 * The drawer follows the conventions in components/pricing-modal.tsx: Escape
 * closes it, the backdrop closes it on mousedown (so a drag that starts inside
 * the panel and ends on the backdrop does not), and while it is open the page
 * behind is marked inert so a screen reader does not wander into it.
 */
export function Sidebar({
  open,
  onClose,
  plan,
  onUpgrade,
  onSearchFocus,
}: {
  /** Whether the off-canvas drawer is open. Ignored from `lg` up. */
  open: boolean;
  onClose: () => void;
  plan: Plan | null;
  onUpgrade: () => void;
  onSearchFocus: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  /*
   * Closing on navigation is what makes the drawer usable on a phone: without
   * it the panel stays over the page the user just asked for. Keyed on the
   * pathname rather than on the link's own click handler so a back/forward
   * navigation closes it too.
   */
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const isPro = plan === "pro";

  return (
    <>
      {open ? (
        <div
          aria-hidden
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        />
      ) : null}

      <aside
        /*
         * The drawer is only moved off screen with a transform, which would
         * leave its links focusable and a keyboard user tabbing into an
         * invisible panel. `invisible` is what actually takes it out of the tab
         * order and the accessibility tree, and `lg:visible` restores it for
         * the desktop rail — which is also why this is not `inert={!open}`:
         * `open` describes the mobile drawer only, and is false on desktop
         * where the rail is permanently on screen.
         */
        className={`fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col border-r border-line bg-surface transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 lg:visible ${
          open ? "translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <Link
            href="/dashboard"
            className="flex min-w-0 items-center gap-2.5 transition-colors hover:text-accent"
          >
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#e5c158] via-[#d4af37] to-[#b89228] text-[0.8rem] font-bold text-accent-ink"
            >
              TS
            </span>
            <span className="min-w-0 font-serif text-[0.95rem] leading-tight font-semibold tracking-tight">
              ToolStackAI
              <span className="block text-[0.7rem] font-normal tracking-normal text-muted">
                Book Studio
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-md p-1.5 text-muted transition-colors hover:text-accent lg:hidden"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={onSearchFocus}
            className="flex w-full items-center gap-2 rounded-lg border border-control bg-surface-2 px-3 py-2 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <SearchIcon className="size-4" />
            Search
            <kbd className="ml-auto rounded border border-line px-1.5 py-0.5 font-mono text-[0.65rem] text-faint">
              /
            </kbd>
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActivePath(pathname, item.href);
              const ItemIcon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-accent-soft font-semibold text-accent"
                        : "text-muted hover:bg-surface-2 hover:text-ink"
                    }`}
                  >
                    <ItemIcon className="size-[1.15rem] shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-line p-3">
          <div className="rounded-xl border border-accent bg-accent-soft p-3.5">
            <div className="flex items-center gap-2">
              <SparkleIcon className="size-4 text-accent" />
              <span className="text-sm font-semibold">
                {isPro ? "Pro plan" : "Upgrade Plan"}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              {isPro
                ? "You are on Pro — 100,000 AI credits a month."
                : "Go Pro for 100,000 AI credits a month and every export format."}
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm mt-3 w-full"
              onClick={onUpgrade}
            >
              {isPro ? "Manage plan" : "Upgrade Plan"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
