"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseMediaUrl, parseText } from "@/lib/storefront/validation";

export async function addPortfolioItem(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();

  const mediaUrl = parseMediaUrl(String(formData.get("media_url") ?? ""));
  if (!mediaUrl) redirect("/dashboard/portfolio?error=" + encodeURIComponent("Enter a valid http(s) link to your video"));
  const caption = parseText(String(formData.get("caption") ?? ""), 200);

  const { error } = await supabase
    .from("portfolio_items")
    .insert({ creator_id: user.id, media_url: mediaUrl, caption });
  if (error) redirect("/dashboard/portfolio?error=" + encodeURIComponent(error.message));

  const { data: p } = await supabase
    .from("creator_profiles").select("handle").eq("user_id", user.id).maybeSingle();
  if (p?.handle) revalidatePath(`/c/${p.handle}`);
  redirect("/dashboard/portfolio?saved=1");
}

export async function deletePortfolioItem(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();
  const id = String(formData.get("id") ?? "");

  const { error } = await supabase
    .from("portfolio_items").delete().eq("id", id).eq("creator_id", user.id);
  if (error) redirect("/dashboard/portfolio?error=" + encodeURIComponent(error.message));

  const { data: p } = await supabase
    .from("creator_profiles").select("handle").eq("user_id", user.id).maybeSingle();
  if (p?.handle) revalidatePath(`/c/${p.handle}`);
  redirect("/dashboard/portfolio?saved=1");
}
