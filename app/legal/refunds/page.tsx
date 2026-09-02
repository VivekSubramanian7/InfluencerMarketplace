import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy | Clipline",
};

export default function RefundsPage() {
  return (
    <article className="prose-legal">
      <h1 className="text-3xl font-black tracking-tight">Refund Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: September 2, 2026</p>

      <section className="mt-10 space-y-6">
        <h2>How Deals Work</h2>
        <p>
          Clipline uses an enforced deal pipeline with anti-ghosting timers. Every deal moves through
          clear stages (booked, accepted, preview submitted, approved, and published) with deadlines
          at each step. This structure protects both sides.
        </p>

        <h2>When Brands Get a Refund</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong className="text-foreground">Creator does not accept:</strong> if the creator
            declines or the acceptance timer expires, the brand receives a full refund automatically.
          </li>
          <li>
            <strong className="text-foreground">Creator does not deliver:</strong> if the creator
            accepts but fails to submit a preview before the delivery deadline, the brand receives
            a full refund automatically.
          </li>
          <li>
            <strong className="text-foreground">Mutual cancellation:</strong> if both parties agree
            to cancel at any stage, the brand receives a full refund.
          </li>
        </ul>

        <h2>When Refunds Are Not Available</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong className="text-foreground">After approval or auto-approve:</strong> once a brand
            approves the deliverable (or the auto-approve timer expires without action), the deal is
            considered complete and the creator is paid. No refund is issued.
          </li>
          <li>
            <strong className="text-foreground">Subjective dissatisfaction:</strong> disagreements
            about creative quality after approval are not grounds for a refund. Use the revision cap
            and preview stage to request changes before approving.
          </li>
        </ul>

        <h2>Disputes</h2>
        <p>
          If you believe a deal was handled unfairly, contact us within 14 days of deal completion.
          We review disputes on a case-by-case basis and may issue partial or full refunds at our discretion.
        </p>

        <h2>Payouts to Creators</h2>
        <p>
          Creator payouts are released after deal completion according to the platform&rsquo;s payout
          schedule. If a refund is issued before payout, no funds are deducted from the creator.
        </p>

        <h2>Contact</h2>
        <p>Refund questions? Email us at <span className="font-medium text-foreground">support@clipline.com</span>.</p>
      </section>
    </article>
  );
}
