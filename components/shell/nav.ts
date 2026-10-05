import type { ComponentType } from "react";

import {
  BookIcon,
  ChatIcon,
  CreditsIcon,
  HomeIcon,
  PlusIcon,
  SettingsIcon,
  SlidersIcon,
  TemplateIcon,
  TranslateIcon,
} from "./icons";

/**
 * The shell's navigation, defined once.
 *
 * The sidebar renders it and the header's universal search filters it, so the
 * two cannot drift apart. `description` is what the search matches beyond the
 * label — "comment" should find Collaboration, and "billing" should find AI
 * Credits, without either word appearing in the sidebar itself.
 */
export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Home",
    description: "Dashboard, recent books and workspace overview",
    icon: HomeIcon,
  },
  {
    href: "/dashboard/books",
    label: "My Books",
    description: "Every manuscript in this workspace",
    icon: BookIcon,
  },
  {
    href: "/dashboard/books/new",
    label: "New Book",
    description: "Upload a manuscript and start formatting",
    icon: PlusIcon,
  },
  {
    href: "/dashboard/credits",
    label: "AI Credits",
    description: "Balance, usage history, billing and top-ups",
    icon: CreditsIcon,
  },
  {
    href: "/dashboard/templates",
    label: "Templates & Styles",
    description: "Genre typesettings and trim sizes",
    icon: TemplateIcon,
  },
  {
    href: "/dashboard/presets",
    label: "Publishing Presets",
    description: "Reusable genre, trim and typography bundles",
    icon: SlidersIcon,
  },
  {
    href: "/dashboard/translation",
    label: "Translation",
    description: "Translate a manuscript into another language",
    icon: TranslateIcon,
  },
  {
    href: "/dashboard/collaboration",
    label: "Collaboration",
    description: "Agency workspaces, reviewers, editors and comments",
    icon: ChatIcon,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    description: "Account, workspace members and preferences",
    icon: SettingsIcon,
  },
];

/**
 * Whether `href` is the section currently being viewed.
 *
 * `/dashboard` is a prefix of every other route here, so a plain
 * `startsWith` would light up Home on every page. It is matched exactly, and
 * the rest match their own subtree.
 */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
