import type { Metadata } from "next";

import { AppShell } from "@/components/shell/AppShell";

/**
 * The dashboard's frame.
 *
 * Every route under /dashboard — the book grid, a book's workspace, credits,
 * collaboration — renders inside this, so the sidebar and header are mounted
 * once and survive navigation between them. A layout rather than a component
 * each page imports, because a page that mounted its own chrome would remount
 * it on every navigation and lose the sidebar's scroll position and the
 * header's search box.
 *
 * `title` is the bare string form for the reason given in app/layout.tsx: the
 * root's default title is not a template, so naming the section here does not
 * compound with it.
 */
export const metadata: Metadata = {
  title: "Dashboard — ToolStackAI Book Studio",
};

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
