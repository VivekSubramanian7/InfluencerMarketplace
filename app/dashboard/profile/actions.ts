"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseHandle, parseTags, parseText } from "@/lib/storefront/validation";

export async function saveCreatorProfile(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();

  const handle = parseHandle(String(formData.get("handle") ?? ""));
  if (!handle) redirect("/dashboard/profile?error=" + encodeURIComponent("Handle must be 3-30 chars: a-z, 0-9, _"));

  const bio = parseText(String(formData.get("bio") ?? ""), 1000);
  const country = parseText(String(formData.get("country") ?? ""), 60);
  const niches = parseTags(String(formData.get("niches") ?? ""));
  const languages = parseTags(String(formData.get("languages") ?? ""), 5);

  const { data: existing } = await supabase
    .from("creator_profiles")
    .select("handle")
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("creator_profiles").upsert({
    user_id: user.id, handle, bio, country, niches, languages,
  });
  if (error) {
    const msg = error.code === "23505" ? "That handle is taken" : error.message;
    redirect("/dashboard/profile?error=" + encodeURIComponent(msg));
  }

  revalidatePath(`/c/${handle}`);
  if (existing?.handle && existing.handle !== handle) {
    revalidatePath(`/c/${existing.handle}`);
  }
  redirect("/dashboard/profile?saved=1");
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
    redirect("/dashboard/profile?error=" + encodeURIComponent(error?.message ?? "Create your profile first"));
  }

  revalidatePath(`/c/${row.handle}`);
  redirect("/dashboard/profile?saved=1");
}
