"use client";

import { createContext, useContext } from "react";

import type { WorkspaceMembership } from "@/lib/workspaces";

/**
 * The workspace every page in the dashboard shell is currently scoped to.
 *
 * It lives in a context rather than in each page because the choice is made in
 * one place — the switcher in the header — and read in many: the book grid
 * filters by it, a new book is filed into it, and the collaboration drawer
 * resolves reviewers through it. Threading it down as a prop would mean every
 * intermediate component naming a value it never uses.
 *
 * `useWorkspace` throws rather than returning null when there is no provider.
 * A page that silently rendered an empty workspace because it was mounted
 * outside the shell would look like "you have no books", which is a worse
 * failure than a loud one.
 */
export interface WorkspaceContextValue {
  workspaces: WorkspaceMembership[];
  /** Null only while the list is still loading, or when it failed. */
  active: WorkspaceMembership | null;
  setActiveId: (id: string) => void;
  loading: boolean;
  error: string | null;
  /** Re-read the list, after creating an agency workspace for instance. */
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const WorkspaceProvider = WorkspaceContext.Provider;

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error(
      "useWorkspace was called outside the dashboard shell. Wrap the tree in AppShell.",
    );
  }
  return value;
}
