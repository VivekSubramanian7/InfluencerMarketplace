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
  const [{ data: p }, { data: socials }] = await Promise.all([
    supabase
      .from("creator_profiles")
      .select("handle, bio, niches, country, languages, status")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("connected_accounts")
      .select("platform_handle")
      .eq("creator_id", user.id)
      .eq("platform", "instagram")
      .limit(1),
  ]);
  const instaHandle = socials?.[0]?.platform_handle ?? undefined;

  return (
    <WizardShell step="profile">
      <ProfileForm
        profile={p}
        action={saveProfileStep}
        mode="wizard"
        suggestedHandle={!p?.handle ? instaHandle : undefined}
        error={error}
      />
    </WizardShell>
  );
}
