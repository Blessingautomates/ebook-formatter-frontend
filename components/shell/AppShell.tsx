"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PricingModal } from "@/components/pricing-modal";
import { SUPABASE_SETUP_HINT, isSupabaseConfigured } from "@/lib/supabase/env";
import { getMyCredits, type CreditSummary } from "@/lib/credits";
import { listManuscripts } from "@/lib/manuscripts";
import { createClient } from "@/lib/supabase/client";
import { getMySubscription, type Plan } from "@/lib/subscriptions";
import {
  ensurePersonalWorkspace,
  listMyWorkspaces,
  type WorkspaceMembership,
} from "@/lib/workspaces";

import { Sidebar } from "./Sidebar";
import { TopHeader, type HeaderNotification, type SearchableBook } from "./TopHeader";
import { AccountProvider } from "./account-context";
import { WorkspaceProvider } from "./workspace-context";

function messageFor(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** The remembered workspace is per account, so two logins do not share one. */
function workspaceStorageKey(userId: string): string {
  return `book-studio:workspace:${userId}`;
}

function readRememberedWorkspace(userId: string): string | null {
  try {
    return window.localStorage.getItem(workspaceStorageKey(userId));
  } catch {
    // Private windows and blocked storage throw here. Remembering the choice is
    // a convenience; failing to is not worth breaking the page over.
    return null;
  }
}

function rememberWorkspace(userId: string, workspaceId: string): void {
  try {
    window.localStorage.setItem(workspaceStorageKey(userId), workspaceId);
  } catch {
    // As above.
  }
}

/**
 * The dashboard's chrome: sidebar, header, and the state they share.
 *
 * It owns the account-level reads — who is signed in, their plan, their credits
 * and their workspaces — because both the sidebar and the header need them, and
 * because a page that had to load them itself would reload them on every
 * navigation. The page's own content arrives as `children`.
 *
 * Mounted from app/dashboard/layout.tsx, so it wraps every dashboard route.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [email, setEmail] = useState<string | null>(null);
  /** Sent to Paddle as custom data, so the webhook can attribute a payment. */
  const [userId, setUserId] = useState<string | null>(null);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [pricingOpen, setPricingOpen] = useState(false);

  const [credits, setCredits] = useState<CreditSummary | null>(null);
  const [creditsError, setCreditsError] = useState<string | null>(null);

  const [workspaces, setWorkspaces] = useState<WorkspaceMembership[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [workspacesError, setWorkspacesError] = useState<string | null>(null);

  const [bookIndex, setBookIndex] = useState<SearchableBook[]>([]);

  // ---- account, plan, workspaces -------------------------------------------

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setWorkspacesLoading(false);
      setWorkspacesError(SUPABASE_SETUP_HINT);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const {
          data: { user },
        } = await createClient().auth.getUser();
        if (cancelled) return;
        setEmail(user?.email ?? null);
        setUserId(user?.id ?? null);

        const record = await getMySubscription();
        if (cancelled) return;
        const resolvedPlan = record?.plan ?? "free";
        setPlan(resolvedPlan);

        /*
         * Credits are read after the plan, because the allowance shown beside
         * the balance is the plan's. A failure here is reported rather than
         * swallowed: the ledger tables arrive with a schema change, so the
         * common cause is a project that has not had supabase/schema.sql
         * applied yet, and saying so is more useful than an empty meter.
         */
        try {
          const summary = await getMyCredits(resolvedPlan);
          if (!cancelled) setCredits(summary);
        } catch (caught) {
          if (!cancelled) {
            setCreditsError(
              messageFor(caught, "Your credits could not be loaded."),
            );
          }
        }
      } catch (caught) {
        if (!cancelled) {
          setWorkspacesError(
            messageFor(caught, "Your account could not be loaded."),
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * The workspace list, and the one to open.
   *
   * The personal workspace is created on demand first, so a brand-new account
   * has somewhere to put a book rather than an empty picker. The remembered
   * choice is only honoured if it is still in the list — an agency workspace
   * the user was removed from must not leave the dashboard scoped to it.
   */
  const loadWorkspaces = useCallback(async (): Promise<void> => {
    if (!isSupabaseConfigured) return;
    setWorkspacesLoading(true);
    setWorkspacesError(null);
    try {
      const personal = await ensurePersonalWorkspace();
      const memberships = await listMyWorkspaces();
      setWorkspaces(memberships);

      setWorkspaceId((current) => {
        const ids = memberships.map((item) => item.workspace.id);
        if (current && ids.includes(current)) return current;
        const remembered = userId ? readRememberedWorkspace(userId) : null;
        if (remembered && ids.includes(remembered)) return remembered;
        return personal.id ?? memberships[0]?.workspace.id ?? null;
      });
    } catch (caught) {
      setWorkspacesError(
        messageFor(caught, "Your workspaces could not be loaded."),
      );
    } finally {
      setWorkspacesLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  const selectWorkspace = useCallback(
    (id: string) => {
      setWorkspaceId(id);
      if (userId) rememberWorkspace(userId, id);
    },
    [userId],
  );

  // ---- search index and notifications --------------------------------------

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    void (async () => {
      try {
        const rows = await listManuscripts(50);
        if (!cancelled) {
          setBookIndex(rows.map((row) => ({ id: row.id, title: row.title })));
        }
      } catch {
        // Search falls back to features alone. Not worth an error banner: the
        // dashboard itself reports a failed book load where it matters.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * What the bell shows.
   *
   * Derived from the books that are already loaded rather than a notifications
   * table — there is no event stream behind this yet, and inventing one would
   * mean a bell that lies. A book that was never edited here cannot be exported
   * without its file being uploaded again, which is the one thing about a saved
   * project that is genuinely easy to miss, so that is what it surfaces.
   */
  const notifications = useMemo<HeaderNotification[]>(() => {
    return bookIndex
      .filter((book) => book.title.trim().length === 0)
      .map((book) => ({
        id: book.id,
        title: "A book has no title",
        body: "Give it a title so it is recognisable in exports and listings.",
        href: `/dashboard/books/${book.id}`,
      }));
  }, [bookIndex]);

  // ---- actions --------------------------------------------------------------

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      // Only when the user is not already typing somewhere, or the shortcut
      // would eat a slash in the middle of a sentence.
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  async function signOut(): Promise<void> {
    try {
      await createClient().auth.signOut();
    } catch {
      // Leaving is what was asked for; a failed token revoke must not strand
      // the user on the page they are trying to leave.
    }
    router.replace("/login");
    router.refresh();
  }

  const activeMembership =
    workspaces.find((item) => item.workspace.id === workspaceId) ?? null;

  const workspaceValue = useMemo(
    () => ({
      workspaces,
      active: activeMembership,
      setActiveId: selectWorkspace,
      loading: workspacesLoading,
      error: workspacesError,
      refresh: loadWorkspaces,
    }),
    [
      workspaces,
      activeMembership,
      selectWorkspace,
      workspacesLoading,
      workspacesError,
      loadWorkspaces,
    ],
  );

  const accountValue = useMemo(
    () => ({
      email,
      plan,
      credits,
      creditsError,
      onUpgrade: () => setPricingOpen(true),
    }),
    [email, plan, credits, creditsError],
  );

  return (
    <WorkspaceProvider value={workspaceValue}>
      <AccountProvider value={accountValue}>
        <div className="flex min-h-screen">
          <Sidebar
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            plan={plan}
            onUpgrade={() => setPricingOpen(true)}
            onSearchFocus={() => searchRef.current?.focus()}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <TopHeader
              onOpenSidebar={() => setSidebarOpen(true)}
              searchRef={searchRef}
              books={bookIndex}
              notifications={notifications}
              email={email}
              plan={plan}
              credits={credits}
              creditsError={creditsError}
              onUpgrade={() => setPricingOpen(true)}
              onSignOut={() => void signOut()}
            />

            <main className="min-w-0 flex-1">{children}</main>
          </div>
        </div>

        <PricingModal
          open={pricingOpen}
          onClose={() => setPricingOpen(false)}
          plan={plan ?? "free"}
          email={email}
          userId={userId}
        />
      </AccountProvider>
    </WorkspaceProvider>
  );
}
