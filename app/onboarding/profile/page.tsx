import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { saveProfileStep } from "./actions";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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
    .select("handle, bio, niches, country, languages")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <WizardShell step="profile">
      <p className="mt-2 text-sm text-muted-foreground">
        Your handle becomes your public storefront URL — brands will find you at /c/your-handle.
      </p>
      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <form action={saveProfileStep} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="handle">Handle</Label>
          <Input id="handle" name="handle" defaultValue={p?.handle ?? ""} required placeholder="e.g. caseyclips" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" name="bio" defaultValue={p?.bio ?? ""} rows={4} placeholder="What you make and who it's for." />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="niches">Niches (comma-separated, up to 8)</Label>
          <Input id="niches" name="niches" defaultValue={(p?.niches ?? []).join(", ")} placeholder="food, lifestyle" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="country">Country</Label>
          <Input id="country" name="country" defaultValue={p?.country ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="languages">Languages (comma-separated, up to 5)</Label>
          <Input id="languages" name="languages" defaultValue={(p?.languages ?? []).join(", ")} />
        </div>
        <SubmitButton className="mt-2 self-start" pendingLabel="Saving…">
          Save and continue
        </SubmitButton>
      </form>
    </WizardShell>
  );
}
