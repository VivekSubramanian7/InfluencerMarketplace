import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { addHighlight, removeHighlight } from "./actions";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { PortfolioPanel } from "@/components/creator/portfolio-panel";

export default async function OnboardingHighlightsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { user } = await requireRole("creator", "/onboarding/highlights");
  const { error, saved } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: profile } = await supabase
    .from("creator_profiles").select("handle").eq("user_id", user.id).maybeSingle();
  if (!profile) {
    redirect("/onboarding/profile?error=" + encodeURIComponent("Claim your handle first"));
  }

  const { data: items } = await supabase
    .from("portfolio_items")
    .select("id, media_url, caption")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <WizardShell step="highlights" skip={false}>
      <PortfolioPanel
        items={items ?? []}
        addAction={addHighlight}
        deleteAction={removeHighlight}
        mode="wizard"
        continueHref="/onboarding/publish"
        gradientSeed={profile.handle}
        error={error}
        saved={saved}
      />
    </WizardShell>
  );
}
