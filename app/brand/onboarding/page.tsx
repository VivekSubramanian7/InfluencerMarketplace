import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { BrandProfileForm } from "@/components/brand/brand-profile-form";
import { WebsiteIngest } from "@/components/brand/website-ingest";
import type { IngestProposal } from "@/lib/brand/ingest";
import Link from "next/link";

export default async function BrandOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; proposal?: string }>;
}) {
  const { user } = await requireRole("brand", "/brand/onboarding");
  const { error } = await searchParams;
  const supabase = await createServerSupabase();

  // brand_profiles row existence = onboarded (creator-wizard precedent:
  // progress derived from data, no tracking column)
  const { data: existing } = await supabase
    .from("brand_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) redirect("/brand");

  const { data: ingestion } = await supabase
    .from("brand_ingestions")
    .select("website, payload")
    .eq("brand_id", user.id)
    .maybeSingle();
  const proposal = (ingestion?.payload as IngestProposal | undefined) ?? null;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Tell us about your brand</h1>
        <Link
          href="/discover"
          className="shrink-0 text-sm font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Do this later → Discover
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        This shapes which creators we suggest, and gives the creators you work
        with your guidelines up front. Everything can be changed later in Brand
        settings.
      </p>
      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-6 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">Start with your website</h2>
        <div className="mt-2">
          <WebsiteIngest from="onboarding" website={ingestion?.website ?? null} proposal={proposal} />
        </div>
      </div>
      <div className="mt-6">
        <BrandProfileForm
          defaults={
            proposal
              ? {
                  company: null,
                  website: ingestion?.website ?? null,
                  description: proposal.description || null,
                  notes: proposal.tone ? `Tone of voice: ${proposal.tone}` : null,
                  outreach_template: null,
                  pref_niches: proposal.niches,
                  pref_types: [],
                  guidelines_path: null,
                  rules_path: null,
                }
              : null
          }
          from="onboarding"
          productsJson={
            proposal && proposal.products.length > 0 ? JSON.stringify(proposal.products) : null
          }
        />
      </div>
    </main>
  );
}
