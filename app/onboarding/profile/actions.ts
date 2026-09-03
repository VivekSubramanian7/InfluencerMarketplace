"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { upsertCreatorProfileFromForm } from "@/lib/creator/profile-core";
import { trackServerEvent } from "@/lib/analytics";

export async function saveProfileStep(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();

  const result = await upsertCreatorProfileFromForm(supabase, user.id, formData);
  if (!result.ok) {
    redirect("/onboarding/profile?error=" + encodeURIComponent(result.error));
  }

  trackServerEvent("onboarding_step_completed", user.id, { step: "profile" });

  revalidatePath(`/c/${result.handle}`);
  if (result.previousHandle && result.previousHandle !== result.handle) {
    revalidatePath(`/c/${result.previousHandle}`);
  }
  redirect("/onboarding/socials");
}
