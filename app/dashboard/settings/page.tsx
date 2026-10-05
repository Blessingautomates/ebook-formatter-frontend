"use client";

import Link from "next/link";

import { Notice } from "@/components/primitives";
import { useAccount } from "@/components/shell/account-context";
import { useWorkspace } from "@/components/shell/workspace-context";
import { ROLE_LABELS } from "@/lib/workspaces";

/**
 * Settings.
 *
 * What it shows is what the product actually knows about an account: the
 * address it signs in with, the plan it is on, and the workspaces it belongs
 * to. There is no display-name field and no password form, because neither
 * exists — Supabase holds the credentials and the app never sees them, and a
 * form that looked like it changed a name would be changing nothing.
 */
export default function SettingsPage() {
  const { email, plan, credits, onUpgrade } = useAccount();
  const { workspaces, loading } = useWorkspace();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 lg:px-8">
      <header>
        <h1 className="font-serif text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Your account, plan and workspace memberships.
        </p>
      </header>

      <section className="card space-y-4 p-5">
        <h2 className="font-serif text-base font-semibold">Account</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted">Email</dt>
            <dd>{email ?? "—"}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted">Plan</dt>
            <dd>{plan === "pro" ? "Pro" : "Free"}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted">Credit balance</dt>
            <dd>
              {credits
                ? `${new Intl.NumberFormat("en-US").format(credits.balance)} of ${new Intl.NumberFormat("en-US").format(credits.allowance)}`
                : "—"}
            </dd>
          </div>
        </dl>
        <p className="border-t border-line pt-3 text-xs text-muted">
          Your password and sign-in are handled by Supabase Auth. The application
          never receives them.
        </p>
        <button type="button" className="btn btn-sm" onClick={onUpgrade}>
          {plan === "pro" ? "Manage subscription" : "Upgrade to Pro"}
        </button>
      </section>

      <section className="card space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-base font-semibold">Workspaces</h2>
          <Link href="/dashboard/collaboration" className="btn btn-sm">
            Manage members
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-muted">Loading workspaces…</p>
        ) : workspaces.length === 0 ? (
          <Notice>
            No workspaces yet. One is created for you the first time the
            dashboard loads.
          </Notice>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {workspaces.map((membership) => (
              <li
                key={membership.workspace.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span>{membership.workspace.name}</span>
                <span className="text-xs text-muted">
                  {membership.workspace.kind === "agency" ? "Agency" : "Personal"}
                  {" · "}
                  {ROLE_LABELS[membership.role]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
