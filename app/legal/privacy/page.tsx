import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Clipline",
};

export default function PrivacyPage() {
  return (
    <article className="prose-legal">
      <h1 className="text-3xl font-black tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: September 2, 2026</p>

      <section className="mt-10 space-y-6">
        <h2>1. Information We Collect</h2>
        <p>
          <strong className="text-foreground">Account data:</strong> name, email address, and role (creator or brand) when you sign up.
        </p>
        <p>
          <strong className="text-foreground">Profile data:</strong> social media handles, portfolio links, bio, and offering details that creators choose to publish.
        </p>
        <p>
          <strong className="text-foreground">Deal data:</strong> briefs, messages, approvals, reviews, and payment amounts associated with deals on the platform.
        </p>
        <p>
          <strong className="text-foreground">Usage data:</strong> pages visited, features used, device type, and IP address, collected automatically via cookies and analytics.
        </p>

        <h2>2. How We Use Your Information</h2>
        <p>We use your data to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Operate and improve the platform</li>
          <li>Process deals and payments between creators and brands</li>
          <li>Send transactional notifications (deal updates, messages)</li>
          <li>Display public creator profiles and reviews</li>
          <li>Detect and prevent fraud or abuse</li>
        </ul>

        <h2>3. Information We Share</h2>
        <p>
          We do not sell your personal data. We share information only with:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong className="text-foreground">Deal counterparties:</strong> brands see creator profiles; creators see brand briefs</li>
          <li><strong className="text-foreground">Payment processors:</strong> to facilitate payouts</li>
          <li><strong className="text-foreground">Analytics providers:</strong> anonymized usage data</li>
          <li><strong className="text-foreground">Legal obligations:</strong> when required by law</li>
        </ul>

        <h2>4. Cookies</h2>
        <p>
          We use essential cookies for authentication and session management. We use analytics cookies
          (Vercel Analytics) to understand aggregate usage. You can disable non-essential cookies in your
          browser settings.
        </p>

        <h2>5. Data Retention</h2>
        <p>
          Account data is retained while your account is active. Deal records and reviews are retained
          indefinitely as part of the platform&rsquo;s public record. You may request deletion of your
          account and personal data at any time.
        </p>

        <h2>6. Your Rights</h2>
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Access, correct, or delete your personal data</li>
          <li>Export your data in a portable format</li>
          <li>Withdraw consent for non-essential data processing</li>
          <li>Lodge a complaint with your local data protection authority</li>
        </ul>

        <h2>7. Security</h2>
        <p>
          We use industry-standard measures to protect your data, including encryption in transit (TLS),
          secure authentication, and row-level security on our database. No system is perfectly secure, and
          we cannot guarantee absolute security.
        </p>

        <h2>8. Children</h2>
        <p>
          Clipline is not intended for anyone under 18. We do not knowingly collect data from minors.
        </p>

        <h2>9. Changes</h2>
        <p>
          We may update this policy periodically. Material changes will be communicated via email or
          a notice on the platform.
        </p>

        <h2>10. Contact</h2>
        <p>Privacy questions? Email us at <span className="font-medium text-foreground">privacy@clipline.com</span>.</p>
      </section>
    </article>
  );
}
