import { createClient } from "./supabase/client";

/**
 * Data access for workspaces and their members.
 *
 * A workspace is the unit everything else hangs off: books belong to one, and a
 * comment thread is readable by whoever is a member of the workspace its book is
 * in. The personal workspace is the default — every account has exactly one,
 * created on demand — and an agency workspace is what an author or a studio adds
 * when someone else needs to review the manuscript.
 *
 * Membership is a table rather than a column because a book can have several
 * reviewers with different jobs, and because the role decides what each of them
 * may do. What a role may do is decided here, beside the roles themselves, so
 * the UI and any future policy cannot disagree about whether an editor can
 * approve a book.
 */

export type WorkspaceKind = "personal" | "agency";

export type WorkspaceRole = "owner" | "editor" | "proofreader" | "approver";

export interface WorkspaceRecord {
  id: string;
  owner_id: string;
  name: string;
  kind: WorkspaceKind;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMembership {
  workspace: WorkspaceRecord;
  role: WorkspaceRole;
}

export interface WorkspaceMember {
  user_id: string;
  role: WorkspaceRole;
  /** Present once the member has a profile row; the id is always present. */
  email: string | null;
  created_at: string;
}

/**
 * The four badge labels from the brief, in one place.
 *
 * "approver" is shown as "Final Approval" because that is the job, not the
 * rank: the person who signs the book off is often not the person who owns the
 * workspace.
 */
export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  editor: "Editor",
  proofreader: "Proofreader",
  approver: "Final Approval",
};

/** Editors and proofreaders mark up the manuscript; owners can too. */
export function canComment(role: WorkspaceRole): boolean {
  return role === "owner" || role === "editor" || role === "proofreader";
}

/**
 * Only an approver or the owner signs a book off.
 *
 * Deliberately excludes editor and proofreader: raising a concern and clearing
 * one are different acts, and a proofreader who could approve their own
 * unresolved comment would make the approval meaningless.
 */
export function canApprove(role: WorkspaceRole): boolean {
  return role === "owner" || role === "approver";
}

/** Adding or removing members is the owner's alone. */
export function canManageMembers(role: WorkspaceRole): boolean {
  return role === "owner";
}

/** Named rather than `select *`, so a column added later cannot leak silently. */
const WORKSPACE_COLUMNS = "id,owner_id,name,kind,created_at,updated_at";

/**
 * The workspaces the signed-in account belongs to, personal one first.
 *
 * `workspace_members` is the entry point rather than `workspaces`, because a
 * member sees a workspace they do not own and the membership row is what
 * carries their role.
 */
export async function listMyWorkspaces(): Promise<WorkspaceMembership[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select(`role, workspace:workspaces(${WORKSPACE_COLUMNS})`)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Could not load your workspaces: ${error.message}`);

  return ((data ?? []) as unknown as {
    role: WorkspaceRole;
    workspace: WorkspaceRecord | null;
  }[])
    .filter((row) => row.workspace !== null)
    .map((row) => ({ role: row.role, workspace: row.workspace as WorkspaceRecord }))
    .sort((a, b) => {
      // Personal first, then by name — the personal workspace is where a
      // single author does nearly all of their work, so it should not move
      // around as agencies are added.
      if (a.workspace.kind !== b.workspace.kind) {
        return a.workspace.kind === "personal" ? -1 : 1;
      }
      return a.workspace.name.localeCompare(b.workspace.name);
    });
}

/**
 * The account's personal workspace, creating it on first call.
 *
 * An RPC rather than an insert: creating it needs a unique constraint to be
 * idempotent, and two tabs calling it at once must not produce two personal
 * workspaces. The function does that with `on conflict do nothing` and returns
 * the existing row either way.
 */
export async function ensurePersonalWorkspace(): Promise<WorkspaceRecord> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc("ensure_personal_workspace")
    .select(WORKSPACE_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Could not open your workspace: ${error.message}`);
  }
  return data as unknown as WorkspaceRecord;
}

/** An agency workspace, owned by the caller. */
export async function createAgencyWorkspace(
  name: string,
): Promise<WorkspaceRecord> {
  const supabase = createClient();
  // The caller becomes owner through a trigger on insert, not through a second
  // statement here: a workspace with no members would be invisible to everyone,
  // including whoever just made it.
  const { data, error } = await supabase
    .from("workspaces")
    .insert({ name: name.trim() || "Untitled workspace", kind: "agency" })
    .select(WORKSPACE_COLUMNS)
    .single();

  if (error) throw new Error(`Could not create the workspace: ${error.message}`);
  if (!data) throw new Error("Could not create the workspace: no row returned.");
  return data as unknown as WorkspaceRecord;
}

/**
 * The members of one workspace, with their addresses where we have them.
 *
 * Two queries rather than an embedded `profiles(email)`: PostgREST resolves an
 * embed through a foreign key, and there is no key between `workspace_members`
 * and `profiles` — both point at `auth.users`. Adding one would mean the member
 * insert fails for anyone whose profile row had not been written yet, which is
 * exactly the ordering the workspace trigger would hit.
 */
export async function listWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, role, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Could not load the members: ${error.message}`);

  const rows = (data ?? []) as unknown as {
    user_id: string;
    role: WorkspaceRole;
    created_at: string;
  }[];

  if (rows.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, email")
    .in(
      "user_id",
      rows.map((row) => row.user_id),
    );

  if (profileError) {
    throw new Error(`Could not load the members: ${profileError.message}`);
  }

  const emails = new Map(
    ((profiles ?? []) as unknown as { user_id: string; email: string | null }[]).map(
      (row) => [row.user_id, row.email],
    ),
  );

  return rows.map((row) => ({
    user_id: row.user_id,
    role: row.role,
    created_at: row.created_at,
    email: emails.get(row.user_id) ?? null,
  }));
}

/**
 * Add a member by email address.
 *
 * An RPC because resolving an address to an account means reading `auth.users`,
 * which the anon key cannot do and RLS will not expose. The function runs as
 * `security definer`, checks the caller owns the workspace, and reports whether
 * the address matched anyone — telling the user "no account with that address"
 * rather than silently adding nobody.
 */
export async function inviteWorkspaceMember(
  workspaceId: string,
  email: string,
  role: WorkspaceRole,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("invite_workspace_member", {
    p_workspace_id: workspaceId,
    p_email: email.trim(),
    p_role: role,
  });

  if (error) throw new Error(`Could not add that member: ${error.message}`);
}

export async function removeWorkspaceMember(
  workspaceId: string,
  userId: string,
): Promise<void> {
  const supabase = createClient();
  // RLS scopes this to workspaces the caller owns, so a row they do not
  // administer simply deletes nothing.
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);

  if (error) throw new Error(`Could not remove that member: ${error.message}`);
}
