"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parsePriceCents, parseText } from "@/lib/storefront/validation";
import { notify } from "@/lib/notify";
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

  const { data: campaign } = await supabase
    .from("campaigns").select("brand_id, title").eq("id", campaignId).maybeSingle();
  if (campaign) {
    await notify({
      userId: campaign.brand_id,
      kind: "application",
      title: `New application on "${campaign.title}"`,
      href: `/campaigns/${campaignId}`,
    });
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

  // Accepting creates the deal at the creator's proposed price (RPC also
  // flips the application to accepted and links the deal).
  if (decision === "accepted") {
    const { data: dealId, error } = await supabase.rpc("accept_campaign_application", {
      p_application_id: id,
    });
    if (error || !dealId) {
      redirect(`/campaigns/${campaignId}?error=` +
        encodeURIComponent(friendlyDbError(error)));
    }
    const { data: app } = await supabase
      .from("campaign_applications").select("creator_id").eq("id", id).maybeSingle();
    if (app) {
      await notify({
        userId: app.creator_id,
        kind: "application_response",
        title: "Your campaign application was accepted — the deal has started",
        href: `/deals/${dealId}`,
        email: true,
      });
    }
    redirect(`/deals/${dealId}`);
  }

  // RLS restricts the update to campaigns this brand owns; the update trigger
  // enforces the pending → declined transition.
  const { data: declined, error } = await supabase
    .from("campaign_applications")
    .update({ status: "declined" })
    .eq("id", id)
    .select("creator_id")
    .maybeSingle();
  if (error || !declined) {
    redirect(`/campaigns/${campaignId}?error=` +
      encodeURIComponent(error ? friendlyDbError(error) : "Application not found"));
  }
  await notify({
    userId: declined.creator_id,
    kind: "application_response",
    title: "Your campaign application was declined",
    href: `/campaigns/${campaignId}`,
  });
  redirect(`/campaigns/${campaignId}?saved=1`);
}
