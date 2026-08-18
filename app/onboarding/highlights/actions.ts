"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseMediaUrl, parseOptionalText } from "@/lib/storefront/validation";

export async function addHighlight(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();

  const { data: profile } = await supabase
    .from("creator_profiles").select("handle").eq("user_id", user.id).maybeSingle();
  if (!profile) {
    redirect("/onboarding/profile?error=" + encodeURIComponent("Claim your handle first"));
  }

  const mediaUrl = parseMediaUrl(String(formData.get("media_url") ?? ""));
  if (!mediaUrl) {
    redirect("/onboarding/highlights?error=" + encodeURIComponent("Paste a valid video link (http/https)"));
  }
  const captionResult = parseOptionalText(String(formData.get("caption") ?? ""), 200);
  if (!captionResult.ok) {
    redirect("/onboarding/highlights?error=" + encodeURIComponent("Caption is too long (max 200 characters)"));
  }

  const { error } = await supabase.from("portfolio_items").insert({
    creator_id: user.id, media_url: mediaUrl, caption: captionResult.value,
  });
  if (error) redirect("/onboarding/highlights?error=" + encodeURIComponent(error.message));

  revalidatePath(`/c/${profile.handle}`);
  redirect("/onboarding/highlights?saved=1");
}

export async function removeHighlight(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();
  const id = String(formData.get("id") ?? "");

  const { error } = await supabase
    .from("portfolio_items").delete().eq("id", id).eq("creator_id", user.id);
  if (error) redirect("/onboarding/highlights?error=" + encodeURIComponent(error.message));

  const { data: profile } = await supabase
    .from("creator_profiles").select("handle").eq("user_id", user.id).maybeSingle();
  if (profile) revalidatePath(`/c/${profile.handle}`);
  redirect("/onboarding/highlights");
}
