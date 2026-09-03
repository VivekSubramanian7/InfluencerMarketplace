import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { saveOfferingStep } from "./actions";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { OfferingsPanel } from "@/components/creator/offerings-panel";

export default async function OnboardingOfferingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { user } = await requireRole("creator", "/onboarding/offerings");
  const { error, saved } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: profile } = await supabase
    .from("creator_profiles").select("handle").eq("user_id", user.id).maybeSingle();
  if (!profile) {
    redirect("/onboarding/profile?error=" + encodeURIComponent("Claim your handle first"));
  }

  const { data: offerings } = await supabase
    .from("offerings")
    .select("id, type, title, price_cents")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <WizardShell step="offerings" skip={false}>
      <OfferingsPanel
        offerings={offerings ?? []}
        saveAction={saveOfferingStep}
        mode="wizard"
        continueHref="/onboarding/highlights"
        error={error}
        saved={saved}
      />
    </WizardShell>
  );
}
