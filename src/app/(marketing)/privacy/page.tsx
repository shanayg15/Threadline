import type { Metadata } from "next";

import { LegalHeading, LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Privacy — Threadline",
  description: "How Threadline handles data. Placeholder template for the open-source project.",
  alternates: { canonical: "/privacy" },
  robots: { index: false },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="June 2026">
      <p>
        Threadline is open-source software you run yourself. When you self-host it, you are the data
        controller for the customer data flowing through your deployment; this template describes
        the kinds of data the application handles so you can adapt it into your own policy.
      </p>

      <LegalHeading>What the application stores</LegalHeading>
      <p>
        To run a post-purchase concierge, Threadline stores brand settings, synced Shopify catalog,
        customers, and orders, conversation transcripts, consent state, and audit records. Customer
        phone numbers and message content are stored so the agent can hold a continuous thread.
      </p>

      <LegalHeading>Consent and messaging</LegalHeading>
      <p>
        Outbound messaging is gated on recorded consent, honors STOP/HELP/START keywords and a
        per-number suppression list, and respects quiet hours in the recipient&apos;s timezone.
        Consent changes are written to an append-only log. Operators are responsible for complying
        with applicable messaging regulations (for example TCPA, CTIA, and A2P 10DLC in the US).
      </p>

      <LegalHeading>Third-party services</LegalHeading>
      <p>
        Depending on how you configure it, your deployment may send data to external services behind
        swappable adapters — for example Shopify, an SMS provider such as Twilio, an LLM provider,
        and a tracking provider. Each is governed by that provider&apos;s own terms and privacy
        policy.
      </p>

      <LegalHeading>Security</LegalHeading>
      <p>
        Integration credentials are encrypted at rest, data is scoped per brand throughout the
        application, and audit and consent logs are append-only. You remain responsible for securing
        your own infrastructure and access.
      </p>
    </LegalPage>
  );
}
