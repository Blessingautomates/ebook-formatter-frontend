"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAccount } from "@/components/shell/account-context";
import {
  ExportIcon,
  PlusIcon,
  ShieldIcon,
  SparkleIcon,
  TypeIcon,
} from "@/components/shell/icons";

/** "blessing@example.com" → "Blessing". Null when there is no name to use. */
function nameFromEmail(email: string | null): string | null {
  const local = email?.split("@")[0]?.trim();
  if (!local) return null;
  const word = local.split(/[._+-]/)[0];
  if (!word) return null;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * The dashboard's greeting banner.
 *
 * The time of day is read in an effect rather than during render. This is a
 * client component, but client components are still server-rendered first, and
 * a greeting computed at render time would be whatever hour the *server* was
 * in — then disagree with the browser on hydration.
 */
export function HeroBanner() {
  const { email } = useAccount();
  const [greeting, setGreeting] = useState("Welcome back");

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(
      hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening",
    );
  }, []);

  const name = nameFromEmail(email);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#141210] via-[#241d15] to-[#3a2c18] px-5 py-7 text-[#f6f1e8] sm:px-8 sm:py-9">
      {/* A warm corner glow, so the flat gradient has a light source. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-accent/20 blur-3xl"
      />

      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <p className="text-xs tracking-[0.2em] text-[#f6f1e8]/60 uppercase">
            ToolStackAI Book Studio
          </p>
          <h1 className="mt-2 font-serif text-2xl leading-tight font-semibold sm:text-3xl">
            {greeting}
            {name ? `, ${name}!` : "!"}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#f6f1e8]/75">
            Your next bestseller is just a few steps away. Upload a manuscript
            and it is measured, checked and set in print-ready type.
          </p>
        </div>

        <Link
          href="/dashboard/books/new"
          className="btn btn-primary shrink-0 shadow-lg"
        >
          <PlusIcon className="size-4" />
          Create New Book
        </Link>
      </div>
    </section>
  );
}

/**
 * Why choose this over a word processor.
 *
 * Each claim is one the backend actually makes, in the order the workflow
 * performs it — the order in the brief. None of the five is aspirational: the
 * analyzer measures, the exporter renders, the pre-scan checks spelling.
 */
const VALUE_PROPS = [
  {
    Icon: SparkleIcon,
    title: "AI-Powered Analysis",
    body: "Word, chapter and page counts, language and script detection, in seconds.",
  },
  {
    Icon: TypeIcon,
    title: "Preserve Your Voice",
    body: "Corrections are proposed, never applied. You accept each one, or none.",
  },
  {
    Icon: TypeIcon,
    title: "Professional Formatting",
    body: "Nine genre sheets, three trim sizes, vector PDF with print-safe margins.",
  },
  {
    Icon: ShieldIcon,
    title: "Final Quality Check",
    body: "Spelling checked against the manuscript's own language, not a fixed list.",
  },
  {
    Icon: ExportIcon,
    title: "Export & Publish",
    body: "PDF, EPUB, DOCX, RTF and TXT — or all five at once as a package.",
  },
];

export function ValueProps() {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-serif text-lg font-semibold">
        Why choose ToolStackAI Book Studio?
      </h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {VALUE_PROPS.map(({ Icon, title, body }) => (
          <li key={title} className="flex gap-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-accent">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {title}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                {body}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
