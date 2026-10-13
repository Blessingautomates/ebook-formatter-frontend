import type { Metadata } from "next";

import {
  LegalPage,
  LegalPlaceholder,
  LegalSection,
  LegalTodo,
} from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Refund Policy — ToolStackAI Book Studio",
  description:
    "The 14-day money-back guarantee on ToolStackAI Book Studio subscriptions, and how refunds are processed by Paddle.",
};

/**
 * The refund policy a payment provider reviews.
 *
 * The guarantee is stated once, in full, at the top — period, who to ask, and
 * that Paddle is the one who actually issues the money. Everything below it
 * answers the questions that follow: what happens after fourteen days, how
 * cancelling differs from refunding, and why the charge is not labelled with our
 * name.
 */
export default function RefundsPage() {
  return (
    <LegalPage
      title="Refund Policy"
      summary="A 14-day money-back guarantee on subscriptions, and how to claim it."
      updated={"<effective date>"}
    >
      <LegalTodo
        items={[
          "Legal entity name — the party offering the guarantee.",
          "The billing descriptor that appears on a customer's bank statement.",
          "Governing law and venue, if it is to be stated on this page too.",
          "The effective date in the heading above.",
        ]}
      />

      <LegalSection heading="The 14-day money-back guarantee">
        <p>
          <strong className="font-medium text-ink">
            If you are not satisfied with a subscription, ask us for a refund
            within 14 days of the payment and we will give you your money back.
          </strong>{" "}
          You do not have to give a reason. This applies to subscription payments
          handled by Paddle, our Merchant of Record.
        </p>
        <p>
          Email{" "}
          <a className="underline decoration-line-strong underline-offset-2" href="mailto:support@toolstackai.xyz">
            support@toolstackai.xyz
          </a>{" "}
          from the address on the account, or reply to your Paddle receipt,
          within the 14 days. We will arrange the refund through Paddle to the
          payment method you used.
        </p>
      </LegalSection>

      <LegalSection heading="How a refund is paid">
        <p>
          All paid plans are sold and processed by{" "}
          <strong className="font-medium text-ink">Paddle</strong>, which acts as
          our Merchant of Record. That means Paddle, not us, is the seller of
          record for your purchase and the party that issues refunds. Paddle
          returns the amount to the payment method you paid with; we cannot send
          a refund to a different card or account.
        </p>
        <p>
          Once Paddle has processed a refund it typically appears within 5 to 10
          business days, depending on your bank or card issuer. If it has not
          arrived after that, contact us and we will chase it with Paddle.
        </p>
      </LegalSection>

      <LegalSection heading="After the first 14 days">
        <p>
          We do not refund subscription periods that have already been billed and
          are more than 14 days old. Cancelling a subscription stops the next
          renewal: you keep access until the end of the period you have already
          paid for, and you are not billed again. If a renewal has taken you by
          surprise, tell us — a renewal refunded within 14 days of that renewal
          is covered by the guarantee above.
        </p>
      </LegalSection>

      <LegalSection heading="What is not covered">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Consumed credits, or work already completed — for example an
            AI-assisted pass that has run and reported its cost. Credits are a
            record of work done, not an unused balance we can take back.
          </li>
          <li>
            Charges older than 14 days, other than a renewal described above.
          </li>
          <li>
            Accounts closed for a breach of the{" "}
            <a className="underline decoration-line-strong underline-offset-2" href="/terms">
              Terms of Service
            </a>
            .
          </li>
          <li>
            Amounts refunded by your bank as a chargeback, which Paddle handles
            through the card network instead.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Your statutory rights">
        <p>
          This policy is in addition to your legal rights, not instead of them.
          If the consumer law where you live gives you a longer cancellation
          period or a stronger right to a refund, that law applies and nothing
          here takes it away.
        </p>
      </LegalSection>

      <LegalSection heading="Why your statement may not say ToolStackAI">
        <p>
          Because Paddle is the Merchant of Record, the charge on your bank
          statement is described as{" "}
          <LegalPlaceholder>billing descriptor</LegalPlaceholder> rather than
          under our name. That is Paddle acting as the seller of record, and it
          is not a charge from an unknown company. Your Paddle receipt is the
          record of the purchase.
        </p>
        <p>
          Questions about a charge, a receipt or a refund can go to us at{" "}
          <a className="underline decoration-line-strong underline-offset-2" href="mailto:support@toolstackai.xyz">
            support@toolstackai.xyz
          </a>{" "}
          or directly to Paddle using the details on your receipt.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to this policy">
        <p>
          We may update this policy; the effective date above will move when we
          do. The policy in force on the date you were billed is the one that
          applies to that payment.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
