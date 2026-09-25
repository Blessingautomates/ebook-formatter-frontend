import Link from "next/link";

import { ACCEPTED_EXTENSIONS } from "@/lib/api";
import { GENRE_OPTIONS, TRIM_OPTIONS } from "@/lib/genres";

/**
 * The editorial landing page. A server component with no hooks and no data
 * fetching, so it prerenders to static HTML — the CTAs are the only things on
 * it that do anything.
 *
 * The formatter needs an account: `/dashboard` is gated by middleware.ts, so a
 * signed-out visitor who follows a "Get Started" is sent to /signup and ends up
 * back where they were headed. The links below go straight to the auth pages so
 * that happens in one hop rather than two.
 */

const FEATURES = [
  {
    title: "Measured the moment it lands",
    body: "Drop a manuscript and get the word count, chapter count and estimated page count back, plus the language and writing system the text was detected as. No configuring a project first.",
  },
  {
    title: "Typos reviewed before they ship",
    body: "Every suspected misspelling is listed with suggestions, its chapter, its line and the surrounding words. Accept or ignore each one, and the corrections go into the exported file rather than dying in a report.",
  },
  {
    title: "Nine genre typesettings",
    body: "Fiction, non-fiction, academic, journal, comic and minimal, plus poetry, technical and children's. Each sets its own typography, leading and page furniture.",
  },
  {
    title: "Five export formats",
    body: "A print-ready PDF rendered with the genre's print stylesheet, or convert to EPUB, DOCX, RTF or TXT from the same analysis.",
  },
];

const FORMATS = [
  { label: "PDF", note: "Print-ready, WeasyPrint", primary: true },
  { label: "EPUB", note: "Reflowable, for Kindle and Apple Books" },
  { label: "DOCX", note: "Editable in Word" },
  { label: "RTF", note: "Editable in most word processors" },
  { label: "TXT", note: "Plain text, wrapped at 72 columns" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <span className="font-serif text-lg font-semibold tracking-tight">
            Ebook Formatter
          </span>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn btn-sm">
              Log in
            </Link>
            <Link href="/signup" className="btn btn-sm">
              Open the formatter
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-line">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(60rem 30rem at 50% -10%, rgb(212 175 55 / 0.14), transparent 70%)",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
            <span className="chip">Manuscript to print-ready</span>
            <h1 className="mx-auto mt-6 max-w-3xl font-serif text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-6xl">
              Format Print-Ready eBooks in Minutes
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
              Upload a manuscript and get it measured, corrected and typeset.
              Nine genre typesettings, five export formats, and no layout
              software to learn.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="btn btn-primary px-6 py-3 text-base"
              >
                Get Started
              </Link>
              <Link href="/login" className="btn px-6 py-3 text-base">
                Log in
              </Link>
            </div>

            <p className="mt-5 text-xs text-faint">
              Accepts {ACCEPTED_EXTENSIONS.join(", ")} · an account saves your
              projects
            </p>
          </div>
        </section>

        {/* Value proposition */}
        <section className="border-b border-line">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
              Everything between the draft and the file you upload
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
              Four steps, in the order you would actually do them.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {FEATURES.map((feature, index) => (
                <div key={feature.title} className="card p-6">
                  <span
                    aria-hidden
                    className="grid size-8 place-items-center rounded-full border border-accent bg-accent-soft font-mono text-sm font-semibold text-accent"
                  >
                    {index + 1}
                  </span>
                  <h3 className="mt-4 font-serif text-lg font-semibold">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {feature.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Genres */}
        <section className="border-b border-line">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
              Nine typesettings, previewed in their own type
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
              Each card shows a real specimen, set in the family and size that
              genre's print stylesheet actually uses.
            </p>

            <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {GENRE_OPTIONS.map((genre) => (
                <li
                  key={genre.id}
                  className="rounded-xl border border-line bg-surface-2 p-4"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      aria-hidden
                      className="leading-none"
                      style={{
                        fontFamily: genre.specimenFont,
                        fontSize: `${genre.specimenPt * 2}pt`,
                      }}
                    >
                      Aa
                    </span>
                    <span className="text-[0.7rem] font-semibold tracking-wider text-faint uppercase">
                      {genre.specimenPt} pt
                    </span>
                  </div>
                  <div className="mt-3 font-serif text-base font-semibold">
                    {genre.label}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    {genre.blurb}
                  </p>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-xs leading-relaxed text-faint">
              Trim sizes:{" "}
              {TRIM_OPTIONS.map((trim) => `${trim.label} (${trim.detail})`).join(
                " · ",
              )}
              . Trim applies to the paged formats; EPUB reflows to the reader.
            </p>
          </div>
        </section>

        {/* Formats */}
        <section className="border-b border-line">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
              Export once, in the format you need
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
              Rendering happens server-side, so the PDF is typeset with the real
              print stylesheet rather than approximated in the browser.
            </p>

            <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {FORMATS.map((format) => (
                <li
                  key={format.label}
                  className={`rounded-xl border p-4 ${
                    format.primary
                      ? "border-accent bg-accent-soft ring-1 ring-accent"
                      : "border-line-strong bg-surface-2"
                  }`}
                >
                  <div
                    className={`font-serif text-lg font-semibold ${
                      format.primary ? "text-accent" : ""
                    }`}
                  >
                    {format.label}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {format.note}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Closing CTA */}
        <section>
          <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
            <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
              Your manuscript is already written
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted">
              The formatting is the part that shouldn&rsquo;t take a weekend.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="btn btn-primary px-6 py-3 text-base"
              >
                Create your account
              </Link>
              <Link href="/login" className="btn px-6 py-3 text-base">
                Log in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-8 text-xs leading-relaxed text-faint sm:px-6">
          Ebook Formatter · format.toolstackai.xyz — manuscripts are analysed and
          rendered server-side, and a format reports the missing package when its
          renderer is not installed.
        </div>
      </footer>
    </div>
  );
}
