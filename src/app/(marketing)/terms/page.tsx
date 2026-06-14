import type { Metadata } from "next";

import { LegalHeading, LegalPage } from "@/components/marketing/legal-page";
import { GITHUB_URL } from "@/lib/marketing/config";

export const metadata: Metadata = {
  title: "Terms — Threadline",
  description: "Terms for using Threadline. Placeholder template for the open-source project.",
  alternates: { canonical: "/terms" },
  robots: { index: false },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="June 2026">
      <p>
        Threadline is open-source software distributed under the MIT License. Your use of the source
        code is governed by that license; this page is a placeholder for the terms a hosted offering
        would add on top.
      </p>

      <LegalHeading>The software is provided as-is</LegalHeading>
      <p>
        As stated in the MIT License, the software is provided &ldquo;as is&rdquo;, without warranty
        of any kind. You run it at your own risk and are responsible for how it is configured and
        used.
      </p>

      <LegalHeading>Your responsibilities as an operator</LegalHeading>
      <p>
        If you deploy Threadline to message real customers, you are responsible for obtaining proper
        consent, complying with applicable messaging and consumer-protection laws, honoring
        opt-outs, and the accuracy of the catalog, policy, and pricing data you connect. Threadline
        never charges a customer&apos;s stored card; purchases flow through customer-paid checkout
        links.
      </p>

      <LegalHeading>License</LegalHeading>
      <p>
        The full license terms live in the repository. See the{" "}
        <a
          href={`${GITHUB_URL}/blob/main/LICENSE`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline underline-offset-4"
        >
          LICENSE file on GitHub
        </a>
        .
      </p>
    </LegalPage>
  );
}
