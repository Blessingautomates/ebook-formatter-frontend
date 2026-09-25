import type { Metadata } from "next";
import "./globals.css";

/**
 * The canonical origin, spelled out once. metadataBase resolves the relative
 * paths below against it, so the OpenGraph URLs come out absolute — which is
 * the point, since whatever reads those tags is a crawler that is not already
 * on this site.
 */
const SITE_URL = "https://format.toolstackai.xyz";
const SITE_NAME = "Ebook Formatter";

const DESCRIPTION =
  "Upload a manuscript to measure it, review the spelling findings, pick a genre, and export a print-ready PDF, EPUB, DOCX, RTF or TXT.";

const TITLE = "Ebook Formatter — Format Print-Ready eBooks in Minutes";

/*
 * `title` is a plain string, not `{ default, template }`. Next's types make
 * `template` required whenever the object form is used, and a template here
 * would render /login and /signup — which already end their titles in
 * "— Ebook Formatter" — as "Sign in — Ebook Formatter · Ebook Formatter". A
 * bare string sets the default and leaves child titles alone.
 *
 * No `alternates.canonical` either — see app/page.tsx. A canonical declared in
 * the root layout is inherited by every route, which would tell Google that
 * /login, /signup and /dashboard are all duplicates of "/".
 *
 * `verification.google` is the meta-tag half of the Search Console claim and
 * public/googleb2fe224c3810ab6e.html is the other; Google accepts either, and
 * keeping both costs nothing.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  /*
   * `summary`, not `summary_large_image`: there is no OG image in the repo, and
   * the large-image card renders as a bare title until there is one.
   */
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
  verification: {
    google: "b2fe224c3810ab6e",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
