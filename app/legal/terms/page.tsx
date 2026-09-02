import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Clipline",
};

export default function TermsPage() {
  return (
    <article className="prose-legal">
      <h1 className="text-3xl font-black tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: September 2, 2026</p>

      <section className="mt-10 space-y-6">
        <h2>1. Agreement to Terms</h2>
        <p>
          By accessing or using the Clipline platform (&ldquo;Service&rdquo;), you agree to be bound by these Terms of Service.
          If you do not agree, do not use the Service. Clipline reserves the right to update these terms at any time;
          continued use after changes constitutes acceptance.
        </p>

        <h2>2. Eligibility</h2>
        <p>
          You must be at least 18 years old and capable of forming a binding contract to use Clipline.
          By registering, you represent that all information you provide is accurate and complete.
        </p>

        <h2>3. Accounts</h2>
        <p>
          You are responsible for maintaining the confidentiality of your account credentials and for all activity
          under your account. Notify us immediately of any unauthorized use.
        </p>

        <h2>4. Creator Obligations</h2>
        <p>
          Creators set their own prices, formats, and revision caps. By accepting a deal, you commit to delivering
          work that matches the agreed brief within the platform&rsquo;s timelines. Failure to deliver may result in
          automatic refunds and account restrictions.
        </p>

        <h2>5. Brand Obligations</h2>
        <p>
          Brands must provide clear, actionable briefs when booking. Approvals and revision requests must be submitted
          within the deal&rsquo;s timelines. Auto-approve timers ensure deals move forward if no action is taken.
        </p>

        <h2>6. Payments</h2>
        <p>
          All payments are processed through our third-party payment provider. Clipline does not store payment card
          details. Creators receive payouts after deal completion according to the platform&rsquo;s payout schedule.
        </p>

        <h2>7. Intellectual Property</h2>
        <p>
          Creators retain ownership of their content. By delivering work through a deal, creators grant the brand
          a license to use the content as specified in the deal brief. The Clipline platform, branding, and software
          remain the property of Clipline.
        </p>

        <h2>8. Prohibited Conduct</h2>
        <p>
          You may not: circumvent platform fees by transacting off-platform for deals initiated on Clipline;
          submit fraudulent reviews; impersonate others; use the Service for unlawful purposes; or interfere
          with the platform&rsquo;s operation.
        </p>

        <h2>9. Limitation of Liability</h2>
        <p>
          Clipline provides the platform &ldquo;as is.&rdquo; We are not liable for disputes between creators
          and brands beyond facilitating the deal process. Our total liability shall not exceed the fees paid
          to Clipline in the 12 months preceding any claim.
        </p>

        <h2>10. Termination</h2>
        <p>
          Either party may terminate their account at any time. Clipline may suspend or terminate accounts that
          violate these terms. Outstanding deal obligations survive termination.
        </p>

        <h2>11. Governing Law</h2>
        <p>
          These terms are governed by the laws of the jurisdiction in which Clipline operates. Disputes shall be
          resolved through binding arbitration unless otherwise required by applicable law.
        </p>

        <h2>12. Contact</h2>
        <p>Questions about these terms? Email us at <span className="font-medium text-foreground">legal@clipline.com</span>.</p>
      </section>
    </article>
  );
}
