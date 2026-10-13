import type { Metadata } from "next";

import {
  LegalPage,
  LegalPlaceholder,
  LegalSection,
  LegalTodo,
} from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — ToolStackAI Book Studio",
  description:
    "The terms you agree to when you use ToolStackAI Book Studio, including what you may upload and who owns your manuscript.",
};

/**
 * The terms of service.
 *
 * The intellectual-property section is the one authors read, so it comes before
 * the mechanics and says the whole thing in its first sentence: the manuscript
 * is yours. Nothing in the licence grant reaches further than operating the
 * Service for the account holder.
 */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      summary="What you may do with the Service, what we may do with your account, and who owns what."
      updated={"<effective date>"}
    >
      <LegalTodo
        items={[
          "Legal entity name and registered address — the contracting party.",
          "Governing law and the exclusive venue for disputes.",
          "Notice period for changes to these terms.",
          "Liability cap figure, if it is to be a specific amount rather than a formula.",
          "The effective date in the heading above.",
        ]}
      />

      <LegalSection heading="Agreement">
        <p>
          These terms are an agreement between you and{" "}
          <LegalPlaceholder>legal entity name</LegalPlaceholder>, of{" "}
          <LegalPlaceholder>registered address</LegalPlaceholder>{" "}
          (&ldquo;we&rdquo;, &ldquo;us&rdquo;), covering your use of ToolStackAI
          Book Studio (the &ldquo;Service&rdquo;). By creating an account or using
          the Service you accept them. If you are agreeing on behalf of an
          organisation, you confirm you may do so.
        </p>
      </LegalSection>

      <LegalSection heading="Intellectual property: your manuscript is yours">
        <p>
          <strong className="font-medium text-ink">
            You retain 100% ownership of every manuscript, cover image and other
            file you upload.
          </strong>{" "}
          We claim no ownership of it and no licence to use it for anything other
          than running the Service for you.
        </p>
        <p>
          The licence you give us is narrow and revocable: a non-exclusive,
          worldwide, royalty-free licence to store, copy, transmit, process and
          display your content{" "}
          <em>solely so that we can operate the Service for your account</em> —
          to measure it, to run the checks you ask for, to render the exports you
          request, and to show it back to you. It ends when you delete the
          content or your account. It does not let us publish your work, share it
          with other users, sell it, or use it to train a machine-learning model.
        </p>
        <p>
          You are responsible for having the rights to everything you upload. Do
          not upload a manuscript you do not own or have permission to format.
        </p>
        <p>
          The Service itself — its software, design, text and trademarks —
          remains ours. We grant you the licence to use it described below; we do
          not transfer it to you.
        </p>
      </LegalSection>

      <LegalSection heading="What you may do with the Service">
        <p>
          Subject to these terms and to your subscription being current, we grant
          you a personal, non-exclusive, non-transferable, revocable licence to
          access and use the Service over the internet, for your own publishing
          and authoring work or the work of an organisation you belong to.
        </p>
        <p>
          The Service is provided as software-as-a-service: we host it and you
          use it. You are not buying a copy of the software, and nothing here
          gives you a right to a copy of it, to install it on your own
          infrastructure, or to resell it.
        </p>
        <p>
          <strong className="font-medium text-ink">
            Everything you export is yours to publish.
          </strong>{" "}
          The PDF, EPUB, DOCX, RTF and TXT files the Service renders from your
          manuscript carry no royalty, no attribution requirement and no
          restriction from us. Sell them, print them, distribute them.
        </p>
      </LegalSection>

      <LegalSection heading="What you may not do">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Upload content you do not have the rights to, or content that is
            unlawful, defamatory, or infringes someone else&rsquo;s copyright or
            trademark.
          </li>
          <li>
            Upload material that is sexually exploitative of minors, incites
            violence, or is otherwise illegal in the jurisdiction you are in or
            the one we operate from.
          </li>
          <li>
            Attempt to access another user&rsquo;s account, manuscripts or data,
            or to probe, scan or breach the Service&rsquo;s authentication or
            security.
          </li>
          <li>
            Use the Service to build a competing product, to scrape it at scale,
            or to resell access to it without our written agreement.
          </li>
          <li>
            Interfere with the Service&rsquo;s operation, including by
            overloading it, circumventing usage limits or credit accounting, or
            automating requests in a way that degrades it for other users.
          </li>
        </ul>
        <p>
          We may suspend or close an account that breaches this section. Where
          the breach is not serious and can be fixed, we will tell you and give
          you a reasonable chance to fix it first.
        </p>
      </LegalSection>

      <LegalSection heading="Your account">
        <p>
          You are responsible for keeping your credentials secret and for what
          happens under your account. Tell us promptly at{" "}
          <a className="underline decoration-line-strong underline-offset-2" href="mailto:support@toolstackai.xyz">
            support@toolstackai.xyz
          </a>{" "}
          if you believe someone else has access to it.
        </p>
        <p>
          You must be old enough to enter a contract where you live to hold an
          account.
        </p>
      </LegalSection>

      <LegalSection heading="Subscriptions, credits and payment">
        <p>
          Paid plans are subscriptions, billed in advance on a recurring basis
          until cancelled. Subscriptions are sold and processed by{" "}
          <strong className="font-medium text-ink">Paddle</strong> as our
          Merchant of Record, so Paddle is the seller of record and handles tax.
          Cancelling stops future renewals; the plan runs to the end of the
          period you have paid for. Refunds are covered by the{" "}
          <a className="underline decoration-line-strong underline-offset-2" href="/refunds">
            Refund Policy
          </a>
          .
        </p>
        <p>
          Some features consume credits. Credit costs are shown before you run a
          pass, and AI-assisted passes report what they cost.
        </p>
      </LegalSection>

      <LegalSection heading="Availability and changes to the Service">
        <p>
          We work to keep the Service available, but we do not promise
          uninterrupted or error-free operation, and we do not offer a service
          level agreement unless we have signed one with you separately. We may
          change, add or remove features.
        </p>
        <p>
          <strong className="font-medium text-ink">
            Your manuscript is never trapped here.
          </strong>{" "}
          If we discontinue the Service, we will give reasonable notice and a
          way to export your work. You can export it at any time in the
          meantime — that is what the export formats are for.
        </p>
        <p>
          We may suspend the Service for maintenance, or to protect it or its
          users from a security or abuse problem.
        </p>
      </LegalSection>

      <LegalSection heading="Disclaimers and limits">
        <p>
          The Service is a formatting and analysis tool. It helps you measure and
          prepare a manuscript; it does not guarantee that a manuscript is free
          of errors, that a finding is correct, that a check has caught
          everything, or that a file will be accepted by a particular retailer or
          printer. Review your own work before you publish it.
        </p>
        <p>
          To the fullest extent the law allows, the Service is provided
          &ldquo;as is&rdquo; and we exclude implied warranties. We are not
          liable for indirect or consequential loss, lost profits, or lost
          manuscripts — keep your own copy of anything you upload. Our total
          liability is limited to{" "}
          <LegalPlaceholder>liability cap</LegalPlaceholder>. Nothing here
          limits liability that cannot lawfully be limited.
        </p>
      </LegalSection>

      <LegalSection heading="Ending this agreement">
        <p>
          You may stop using the Service and close your account at any time. We
          may end this agreement if you materially breach it, if we are required
          to by law, or if we discontinue the Service with notice. The sections
          on intellectual property, disclaimers and limits, and governing law
          survive termination.
        </p>
        <p>
          These terms are governed by the laws of{" "}
          <LegalPlaceholder>governing law and venue</LegalPlaceholder>, and the
          courts there have exclusive jurisdiction, except where the law gives
          you the right to bring a claim where you live.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to these terms">
        <p>
          We may update these terms. If a change materially affects your rights,
          we will give notice{" "}
          <LegalPlaceholder>notice period</LegalPlaceholder> before it takes
          effect, and the effective date at the top of this page will move.
          Continuing to use the Service after that date means you accept the
          updated terms.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
