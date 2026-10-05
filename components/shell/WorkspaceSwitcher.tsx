"use client";

import { useEffect, useRef, useState } from "react";

import { Spinner } from "@/components/primitives";
import { createAgencyWorkspace, ROLE_LABELS } from "@/lib/workspaces";

import { BuildingIcon, CheckIcon, ChevronDownIcon, UserIcon } from "./icons";
import { useWorkspace } from "./workspace-context";

/**
 * Which workspace the dashboard is showing, and the way to change it.
 *
 * The brief asks for a personal workspace and one or more agency workspaces
 * ("Author A → Book 1"), so the control is a picker rather than a label: the
 * current one is always named, and switching is one click. Each row carries the
 * caller's own role for that workspace, because "which hat am I wearing here"
 * is the thing that is genuinely easy to lose track of once there is more than
 * one.
 */
export function WorkspaceSwitcher() {
  const { workspaces, active, setActiveId, loading, error, refresh } =
    useWorkspace();

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!box.current?.contains(event.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setCreating(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function create(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setCreateError(null);
    try {
      const workspace = await createAgencyWorkspace(name);
      await refresh();
      // Switch to what was just made: creating a workspace and staying on the
      // old one reads as though the creation failed.
      setActiveId(workspace.id);
      setName("");
      setCreating(false);
      setOpen(false);
    } catch (caught) {
      setCreateError(
        caught instanceof Error && caught.message
          ? caught.message
          : "The workspace could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }

  const ActiveIcon = active?.workspace.kind === "agency" ? BuildingIcon : UserIcon;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-left transition-colors hover:border-accent"
      >
        <ActiveIcon className="size-4 shrink-0 text-accent" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {active?.workspace.name ??
              (loading ? "Loading workspaces…" : "No workspace")}
          </span>
          <span className="block text-[0.7rem] text-muted">
            {active
              ? ROLE_LABELS[active.role]
              : error
                ? "Unavailable"
                : "Personal workspace"}
          </span>
        </span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted" />
      </button>

      {open ? (
        <div className="absolute inset-x-0 z-40 mt-1.5 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          {error ? (
            <p className="px-3 py-2.5 text-xs leading-relaxed text-danger">
              {error}
            </p>
          ) : loading ? (
            <p className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted">
              <Spinner /> Loading…
            </p>
          ) : (
            <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
              {workspaces.map((membership) => {
                const isActive = membership.workspace.id === active?.workspace.id;
                const RowIcon =
                  membership.workspace.kind === "agency" ? BuildingIcon : UserIcon;
                return (
                  <li key={membership.workspace.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => {
                        setActiveId(membership.workspace.id);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-2 ${
                        isActive ? "bg-accent-soft" : ""
                      }`}
                    >
                      <RowIcon className="size-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">
                          {membership.workspace.name}
                        </span>
                        <span className="block text-[0.7rem] text-muted">
                          {membership.workspace.kind === "agency"
                            ? "Agency workspace"
                            : "Personal workspace"}
                          {" · "}
                          {ROLE_LABELS[membership.role]}
                        </span>
                      </span>
                      {isActive ? (
                        <CheckIcon className="size-4 shrink-0 text-accent" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-line p-2">
            {creating ? (
              <div className="space-y-1.5">
                <input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void create();
                  }}
                  placeholder="Agency or author name"
                  aria-label="New workspace name"
                  className="field"
                />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm flex-1"
                    disabled={busy || !name.trim()}
                    onClick={() => void create()}
                  >
                    {busy ? <Spinner /> : null}
                    Create
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      setCreating(false);
                      setCreateError(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
                {createError ? (
                  <p className="text-xs leading-relaxed text-danger">
                    {createError}
                  </p>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-sm w-full"
                onClick={() => setCreating(true)}
              >
                <BuildingIcon className="size-4" />
                New agency workspace
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
