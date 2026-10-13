import type { Metadata } from "next";

import {
  LegalPage,
  LegalPlaceholder,
  LegalSection,
  LegalTodo,
} from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — ToolStackAI Book Studio",
  description:
    "What ToolStackAI Book Studio stores, how your manuscript is handled, and the cookies the service sets.",
};

/**
 * The privacy policy.
 *
 * Two things here are stated because they are the questions authors actually
 * ask, and a policy that hedges them is worse than no policy:
 *
 * 1. The manuscript is the author's, is not published, and is never used to
 *    train a model.
 * 2. An AI-assisted pass sends the text of the manuscript to Anthropic's API.
 *    Saying "we use AI" without saying that the text leaves our servers would
 *    be a misleading omission, so it is spelled out in its own section.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      summary="What we store, why we store it, and what happens to the manuscript you upload."
      updated={"<effective date>"}
    >
      <LegalTodo
        items={[
          "Legal entity name and registered address — the data controller.",
          "Data Protection Officer or privacy contact, if one is appointed.",
          "Governing law and the courts with jurisdiction over a dispute.",
          "The retention period for a deleted account's backups.",
          "The effective date in the heading above.",
          "The identity of the hosting provider, once production hosting is fixed.",
        ]}
      />

      <LegalSection heading="Who we are">
        <p>
          ToolStackAI Book Studio (&ldquo;the Service&rdquo;) is operated by{" "}
          <LegalPlaceholder>legal entity name</LegalPlaceholder>, of{" "}
          <LegalPlaceholder>registered address</LegalPlaceholder> (the
          &ldquo;Controller&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). We are
          the data controller for the personal data described on this page.
        </p>
        <p>
          You can reach us about anything on this page at{" "}
          <a className="underline decoration-line-strong underline-offset-2" href="mailto:support@toolstackai.xyz">
            support@toolstackai.xyz
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="What we store">
        <p>
          <strong className="font-medium text-ink">Your account.</strong> Your
          email address, and a password hash if you sign up with a password
          rather than a third-party provider. Authentication and session
          management are handled by Supabase. We do not store your password in a
          readable form, and we do not store payment card details at all — see
          &ldquo;Payments&rdquo; below.
        </p>
        <p>
          <strong className="font-medium text-ink">Your manuscripts.</strong>{" "}
          The text, title, author name, genre, trim size and cover images you
          upload or enter, along with the measurements, findings, edits, comments
          and export settings generated from them. This is stored in a Postgres
          database hosted by Supabase, in a row that belongs to your account and
          is readable only by that account.
        </p>
        <p>
          <strong className="font-medium text-ink">Usage and billing.</strong>{" "}
          Your credit balance and the record of what a pass cost. Analytics about
          how the site is used, described under &ldquo;Cookies&rdquo;.
        </p>
      </LegalSection>

      <LegalSection heading="Your manuscript stays yours">
        <p>
          <strong className="font-medium text-ink">
            You keep 100% ownership of everything you upload.
          </strong>{" "}
          We claim no licence over your manuscript beyond what is strictly
          needed to run the Service for you: to store it, to measure it, to
          render the export formats you ask for, and to display it back to you.
        </p>
        <p>
          <strong className="font-medium text-ink">
            We never train a model on your text.
          </strong>{" "}
          Your manuscript is not used to train, fine-tune or otherwise improve
          any machine-learning model, ours or anyone else&rsquo;s, and we do not
          sell or rent it. It is not published, shared or made visible to other
          users. Manuscripts are private to your account by default, and row-level
          security in the database is what enforces that — not a setting you have
          to find and turn on.
        </p>
      </LegalSection>

      <LegalSection heading="AI-assisted passes, and what leaves our servers">
        <p>
          Some features — the Book Doctor scan, the writing-voice profile, the
          story bible and their continuity checks — are AI-assisted. When you
          run one of those passes, the text of your manuscript is sent to{" "}
          <strong className="font-medium text-ink">Anthropic</strong> (the maker
          of the Claude models) for processing, and the result is returned to us.
        </p>
        <p>
          Every other feature runs on our own servers: extracting the text,
          counting words and chapters, measuring reading level, checking
          spelling, and rendering the PDF, EPUB, DOCX, RTF and TXT exports.
          Those never send your manuscript anywhere.
        </p>
        <p>
          Anthropic&rsquo;s API terms do not permit the content sent through it to
          be used to train their models. We do not enable any setting that would
          change that, and you can use the non-AI features of the Service without
          triggering an AI pass at all.
        </p>
      </LegalSection>

      <LegalSection heading="Cookies">
        <p>We set a small number of cookies, and no advertising ones:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="font-medium text-ink">
              Session and authentication cookies
            </strong>{" "}
            (strictly necessary). Set by Supabase to keep you signed in and to
            protect your session. The Service cannot work without them.
          </li>
          <li>
            <strong className="font-medium text-ink">
              Analytics cookies
            </strong>{" "}
            (Google Analytics 4). Used to understand which parts of the Service
            are used, so we know what to build and what to fix. These carry a
            random identifier rather than your email address, and we do not use
            them to build an advertising profile of you.
          </li>
        </ul>
        <p>
          You can block or clear cookies in your browser at any time. Blocking
          the strictly necessary ones will stop you signing in.
        </p>
      </LegalSection>

      <LegalSection heading="Payments">
        <p>
          Subscriptions are sold and processed by{" "}
          <strong className="font-medium text-ink">Paddle</strong>, which acts as
          our Merchant of Record. That means Paddle is the seller of record for
          your purchase: Paddle collects your payment details and handles the
          associated tax. We never see or store your card number. Our refund
          terms are set out in the{" "}
          <a className="underline decoration-line-strong underline-offset-2" href="/refunds">
            Refund Policy
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="Who else processes your data">
        <p>
          We use a small number of processors, each of which handles only what it
          has to:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="font-medium text-ink">Supabase</strong> — database,
            file storage and authentication, including your account email and
            your manuscripts.
          </li>
          <li>
            <strong className="font-medium text-ink">Anthropic</strong> — the
            AI-assisted passes described above, and only when you run one.
          </li>
          <li>
            <strong className="font-medium text-ink">Paddle</strong> — payment
            processing, billing and tax.
          </li>
          <li>
            <strong className="font-medium text-ink">Google</strong> — website
            analytics.
          </li>
          <li>
            <strong className="font-medium text-ink">
              <LegalPlaceholder>hosting provider</LegalPlaceholder>
            </strong>{" "}
            — the servers the application runs on.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="How long we keep it">
        <p>
          Your account data and your manuscripts are kept for as long as your
          account exists. If you ask us to delete your account, we delete your
          manuscripts and personal data from the live database; residual copies
          in encrypted backups are removed within{" "}
          <LegalPlaceholder>backup retention period</LegalPlaceholder>. Billing
          records are retained for as long as tax law requires, which is why
          Paddle holds those separately from us.
        </p>
      </LegalSection>

      <LegalSection heading="Your rights">
        <p>
          Depending on where you live, you may have the right to see the personal
          data we hold about you, to have it corrected or deleted, to receive it
          in a portable form, to object to certain processing, and to withdraw
          consent. To exercise any of these, email{" "}
          <a className="underline decoration-line-strong underline-offset-2" href="mailto:support@toolstackai.xyz">
            support@toolstackai.xyz
          </a>{" "}
          and we will respond within the period the law allows.
        </p>
        <p>
          You can also export your own manuscript at any time: every export
          format is a download of the book you already own, not a locked
          artefact.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to this policy">
        <p>
          If we change how we handle your data we will update this page and move
          the effective date. A change that materially affects what happens to
          your manuscript will be announced in the Service rather than only
          posted here.
        </p>
        <p>
          This policy is governed by the laws of{" "}
          <LegalPlaceholder>governing law and venue</LegalPlaceholder>, and any
          dispute is subject to the courts named there.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
