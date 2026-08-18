import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOnboardingState } from "@/lib/onboarding/state";
import { nextIncompleteStep } from "@/lib/onboarding/steps";

// Dispatcher: send the creator to their first incomplete step.
export default async function OnboardingPage() {
  const { user } = await requireRole("creator", "/onboarding");
  const supabase = await createServerSupabase();
  const state = await getOnboardingState(supabase, user.id);
  const step = nextIncompleteStep(state);
  redirect(step === "done" ? "/dashboard" : `/onboarding/${step}`);
}
