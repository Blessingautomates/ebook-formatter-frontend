import type { Metadata } from "next";
import Script from "next/script";

import { PaddleProvider } from "@/components/paddle-provider";

import "./globals.css";

/** The GA4 measurement ID for format.toolstackai.xyz. */
const GA_MEASUREMENT_ID = "G-D3PFL239DZ";

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
      <body>
        {/*
         * The Paddle checkout is opened from the dashboard, but the provider
         * sits here because it has to be above whatever renders the upgrade
         * button. It is a client component wrapping server-rendered children,
         * so the pages below keep rendering on the server.
         */}
        <PaddleProvider>{children}</PaddleProvider>
        {/*
         * afterInteractive, not beforeInteractive: analytics is not on the
         * critical path, and starting the loader sooner would compete with the
         * first paint for bandwidth. Both tags sit at the end of <body> so the
         * inline config runs after the external script is in place.
         */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}
