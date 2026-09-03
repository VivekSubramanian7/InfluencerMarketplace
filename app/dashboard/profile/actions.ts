"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { upsertCreatorProfileFromForm } from "@/lib/creator/profile-core";

export async function saveCreatorProfile(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();

  const result = await upsertCreatorProfileFromForm(supabase, user.id, formData);
  if (!result.ok) {
    redirect("/dashboard?tab=profile&error=" + encodeURIComponent(result.error));
  }

  revalidatePath(`/c/${result.handle}`);
  if (result.previousHandle && result.previousHandle !== result.handle) {
    revalidatePath(`/c/${result.previousHandle}`);
  }
  redirect("/dashboard?tab=profile&saved=1");
}

export async function setProfileStatus(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();
  const status = formData.get("status") === "live" ? "live" : "draft";

  const { data: row, error } = await supabase
    .from("creator_profiles")
    .update({ status })
    .eq("user_id", user.id)
    .select("handle")
    .maybeSingle();
  if (error || !row) {
    redirect("/dashboard?tab=profile&error=" + encodeURIComponent(error?.message ?? "Create your profile first"));
  }

  revalidatePath(`/c/${row.handle}`);
  redirect("/dashboard?tab=profile&saved=1");
}
