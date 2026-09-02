import { readWebsite } from "@/app/brand/actions";
import type { IngestProposal } from "@/lib/brand/ingest";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";

// Mini-form (separate from the main profile form — forms can't nest) that
// runs website ingestion, plus the proposal banner once results exist.
// Nothing from the proposal is saved until the brand saves the main form.
export function WebsiteIngest({
  from,
  website,
  proposal,
}: {
  from: "onboarding" | "settings";
  website: string | null;
  proposal: IngestProposal | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <form action={readWebsite} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="from" value={from} />
        <Input
          name="website"
          type="url"
          defaultValue={website ?? ""}
          placeholder="https://yourbrand.com"
          aria-label="Website to read"
          className="min-w-64 flex-1"
        />
        <SubmitButton variant="outline" pendingLabel="Reading your site…">
          Read my website
        </SubmitButton>
      </form>
      {proposal ? (
        <div className="rounded-xl border border-ok/30 bg-ok/5 p-4 text-sm">
          <p className="font-semibold">Here&apos;s what we learned. Review below, then save.</p>
          <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
            {proposal.description && <li>Description drafted from your site.</li>}
            {proposal.niches.length > 0 && (
              <li>Suggested niches: {proposal.niches.join(", ")}.</li>
            )}
            {proposal.products.length > 0 && (
              <li>
                {proposal.products.length} product{proposal.products.length === 1 ? "" : "s"} found:{" "}
                {proposal.products.slice(0, 4).map((p) => p.name).join(", ")}
                {proposal.products.length > 4 ? "…" : ""}, added when you save.
              </li>
            )}
            {proposal.tone && <li>Tone we picked up: {proposal.tone}</li>}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            These are suggestions extracted from your website. Edit anything
            before saving. Nothing is published automatically.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          We&apos;ll read your site and pre-fill your description, niches, and
          products for you to review.
        </p>
      )}
    </div>
  );
}
