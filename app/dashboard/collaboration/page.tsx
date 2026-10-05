"use client";

import { useCallback, useEffect, useState } from "react";

import { Notice, Spinner } from "@/components/primitives";
import { useAccount } from "@/components/shell/account-context";
import { BuildingIcon } from "@/components/shell/icons";
import { WorkspaceSwitcher } from "@/components/shell/WorkspaceSwitcher";
import { useWorkspace } from "@/components/shell/workspace-context";
import {
  canManageMembers,
  inviteWorkspaceMember,
  listWorkspaceMembers,
  removeWorkspaceMember,
  ROLE_LABELS,
  type WorkspaceMember,
  type WorkspaceRole,
} from "@/lib/workspaces";

/** Only these can be granted; ownership is not handed out from this form. */
const INVITABLE_ROLES: WorkspaceRole[] = ["editor", "proofreader", "approver"];

/**
 * Collaboration.
 *
 * The roster half of working with other people: who is in a workspace and what
 * each of them may do. Per-chapter discussion lives on the book itself, in the
 * comments drawer, because a note about Chapter 3 belongs beside Chapter 3.
 *
 * Every control is gated on the caller's real role. A proofreader sees the
 * roster and no way to change it, which is the honest rendering of what the
 * database would allow them to do anyway.
 */
export default function CollaborationPage() {
  const { active, loading: workspacesLoading } = useWorkspace();
  const { email } = useAccount();

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("editor");
  const [busy, setBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const workspaceId = active?.workspace.id ?? null;
  const mayManage = active ? canManageMembers(active.role) : false;

  const load = useCallback(async (): Promise<void> => {
    if (!workspaceId) {
      setMembers([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setMembers(await listWorkspaceMembers(workspaceId));
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "The members could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function invite(): Promise<void> {
    if (!workspaceId || busy || !inviteEmail.trim()) return;
    setBusy(true);
    setInviteError(null);
    setNotice(null);
    try {
      await inviteWorkspaceMember(workspaceId, inviteEmail, inviteRole);
      setNotice(`${inviteEmail.trim()} was added as ${ROLE_LABELS[inviteRole]}.`);
      setInviteEmail("");
      await load();
    } catch (caught) {
      setInviteError(
        caught instanceof Error && caught.message
          ? caught.message
          : "That member could not be added.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId: string, address: string | null): Promise<void> {
    if (!workspaceId) return;
    if (!window.confirm(`Remove ${address ?? "this member"} from the workspace?`)) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await removeWorkspaceMember(workspaceId, userId);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "That member could not be removed.",
      );
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 lg:px-8">
      <header>
        <h1 className="font-serif text-2xl font-semibold">Collaboration</h1>
        <p className="mt-1 text-sm text-muted">
          Who can see and review the books in a workspace, and what each of them
          may do.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-serif text-base font-semibold">Workspace</h2>
        <div className="max-w-sm">
          <WorkspaceSwitcher />
        </div>
        {active?.workspace.kind === "agency" ? (
          <p className="flex items-center gap-2 text-xs text-muted">
            <BuildingIcon className="size-4" />
            Agency workspace, owned by {email ?? "this account"}. Invite an
            author, a proofreader and a final approver to review a manuscript
            together.
          </p>
        ) : (
          <p className="text-xs text-muted">
            Your personal workspace. Create an agency workspace from the switcher
            above to bring in a proofreader or an approver.
          </p>
        )}
      </section>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice ? <Notice tone="ok">{notice}</Notice> : null}

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="font-serif text-base font-semibold">Members</h2>
          {loading || workspacesLoading ? <Spinner /> : null}
        </div>

        {members.length === 0 && !loading ? (
          <p className="px-4 py-8 text-center text-sm text-muted">
            No members to show.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {members.map((member) => (
              <li
                key={member.user_id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {member.email ?? member.user_id}
                  </p>
                  <p className="text-xs text-muted">
                    Joined {new Date(member.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[0.7rem]">
                    {ROLE_LABELS[member.role]}
                  </span>
                  {/* The owner cannot be removed from their own workspace. */}
                  {mayManage && member.role !== "owner" ? (
                    <button
                      type="button"
                      className="btn btn-sm text-danger"
                      onClick={() => void remove(member.user_id, member.email)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {active ? (
        mayManage ? (
          <section className="card space-y-3 p-5">
            <h2 className="font-serif text-base font-semibold">Add a member</h2>
            <p className="text-xs text-muted">
              They need an account already — the address is matched against
              registered users, and you will be told if nothing matches.
            </p>

            <div className="flex flex-wrap gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void invite();
                }}
                placeholder="name@example.com"
                aria-label="Member email address"
                className="field min-w-0 flex-1"
              />
              <select
                value={inviteRole}
                onChange={(event) =>
                  setInviteRole(event.target.value as WorkspaceRole)
                }
                aria-label="Member role"
                className="field w-40"
              >
                {INVITABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !inviteEmail.trim()}
                onClick={() => void invite()}
              >
                {busy ? <Spinner /> : null}
                Add
              </button>
            </div>

            {inviteError ? (
              <p className="text-xs leading-relaxed text-danger">{inviteError}</p>
            ) : null}

            <p className="border-t border-line pt-3 text-xs text-muted">
              Editors and proofreaders comment on chapters and resolve threads.
              Only a Final Approval or the owner signs a book off.
            </p>
          </section>
        ) : (
          <Notice>
            Only the workspace owner can add or remove members. You are here as{" "}
            {ROLE_LABELS[active.role]}.
          </Notice>
        )
      ) : null}
    </div>
  );
}
