"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parsePriceCents, parseText } from "@/lib/storefront/validation";
import { friendlyDbError } from "@/lib/errors";

export async function applyToCampaign(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();
  const campaignId = String(formData.get("campaign_id") ?? "");

  const pitch = parseText(String(formData.get("pitch") ?? ""), 2000);
  const price = parsePriceCents(String(formData.get("proposed_price") ?? ""));
  if (!pitch || !price) {
    redirect(`/campaigns/${campaignId}?error=` + encodeURIComponent(
      "Check the form: pitch (≤2000 characters) and a price between $1 and $1,000,000"));
  }

  const { data: creatorProfile } = await supabase
    .from("creator_profiles").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!creatorProfile) {
    redirect("/dashboard/profile?error=" +
      encodeURIComponent("Create your creator profile before applying to campaigns"));
  }

  const { error } = await supabase.from("campaign_applications").insert({
    campaign_id: campaignId,
    creator_id: user.id,
    pitch,
    proposed_price_cents: price,
  });
  if (error) {
    const msg = friendlyDbError(error, {
      "23505": "You already applied to this campaign",
      "42501": "Only creator accounts can apply to campaigns",
    });
    redirect(`/campaigns/${campaignId}?error=` + encodeURIComponent(msg));
  }

  redirect(`/campaigns/${campaignId}?saved=1`);
}

export async function withdrawApplication(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();
  const campaignId = String(formData.get("campaign_id") ?? "");
  const id = String(formData.get("id") ?? "");

  const { error } = await supabase
    .from("campaign_applications")
    .update({ status: "withdrawn" })
    .eq("id", id)
    .eq("creator_id", user.id);
  if (error) {
    redirect(`/campaigns/${campaignId}?error=` + encodeURIComponent(friendlyDbError(error)));
  }
  redirect(`/campaigns/${campaignId}?saved=1`);
}

export async function decideApplication(formData: FormData) {
  await requireRole("brand");
  const supabase = await createServerSupabase();
  const campaignId = String(formData.get("campaign_id") ?? "");
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "accepted" && decision !== "declined") redirect(`/campaigns/${campaignId}`);

  // RLS restricts the update to campaigns this brand owns; the update trigger
  // enforces the pending → accepted/declined transition.
  const { error, count } = await supabase
    .from("campaign_applications")
    .update({ status: decision }, { count: "exact" })
    .eq("id", id);
  if (error || count === 0) {
    redirect(`/campaigns/${campaignId}?error=` +
      encodeURIComponent(error ? friendlyDbError(error) : "Application not found"));
  }
  redirect(`/campaigns/${campaignId}?saved=1`);
}
