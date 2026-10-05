"use client";

import { Notice } from "@/components/primitives";

/**
 * Translation.
 *
 * There is no translation service behind this product. The backend has no
 * route for it, no table stores a translated manuscript, and the analyzer only
 * detects the language a book is already in — it does not produce another.
 *
 * So this page says that, and says what would have to exist first. The
 * alternative — a language picker that appeared to do something — would be a
 * mock screen in the one place where being wrong is expensive: an author who
 * believed their book had been translated.
 */
export default function TranslationPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 lg:px-8">
      <header>
        <h1 className="font-serif text-2xl font-semibold">Translation</h1>
        <p className="mt-1 text-sm text-muted">
          Translate a formatted book into another language.
        </p>
      </header>

      <Notice tone="warn">
        <strong className="font-medium">Not configured.</strong> This deployment
        has no translation provider connected, so nothing on this page will
        translate a manuscript.
      </Notice>

      <section className="card space-y-3 p-5">
        <h2 className="font-serif text-base font-semibold">
          What does work today
        </h2>
        <ul className="space-y-2 text-sm text-muted">
          <li>
            <span className="text-ink">Language detection.</span> The analyzer
            identifies a manuscript&rsquo;s language, script and text direction
            when it measures it, and the export uses all three to set the
            correct hyphenation and reading direction.
          </li>
          <li>
            <span className="text-ink">Language on the book card.</span> The
            detected language is stored with the book and shown as a badge in
            your library.
          </li>
        </ul>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-serif text-base font-semibold">
          What translation would need
        </h2>
        <ol className="space-y-2 text-sm text-muted">
          <li>
            A provider and a key — a machine translation API, or a human service
            with an order flow.
          </li>
          <li>
            A backend route that translates the manuscript and returns it, so
            the credits ledger can charge for it the way analysis does.
          </li>
          <li>
            A decision about venue. A translated manuscript is a separate book,
            not a version of this one: it needs its own title page, its own
            rights page, and its own review before it is published.
          </li>
        </ol>
      </section>
    </div>
  );
}
