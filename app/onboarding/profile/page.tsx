import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { saveProfileStep } from "./actions";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { ProfileForm } from "@/components/creator/profile-form";

export default async function OnboardingProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { user } = await requireRole("creator", "/onboarding/profile");
  const { error } = await searchParams;
  const supabase = await createServerSupabase();
  const { data: p } = await supabase
    .from("creator_profiles")
    .select("handle, bio, niches, country, languages, status")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <WizardShell step="profile">
      <ProfileForm
        profile={p}
        action={saveProfileStep}
        mode="wizard"
        error={error}
      />
    </WizardShell>
  );
}
