"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parsePriceCents, parseText } from "@/lib/storefront/validation";
import { emailUser } from "@/lib/email";
import { friendlyDbError } from "@/lib/errors";
import { creatorCanApply } from "@/lib/campaigns/offering-match";
import { trackServerEvent } from "@/lib/analytics";

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
    redirect("/dashboard?tab=profile&error=" +
      encodeURIComponent("Create your creator profile before applying to campaigns"));
  }

  const { data: campaign } = await supabase
    .from("campaigns").select("brand_id, title, offering_type").eq("id", campaignId).maybeSingle();
  const { data: offerings } = await supabase
    .from("offerings")
    .select("type")
    .eq("creator_id", user.id)
    .eq("active", true);
  const activeTypes = (offerings ?? []).map((o) => o.type);
  if (!campaign || !creatorCanApply({ campaignType: campaign.offering_type, activeOfferingTypes: activeTypes })) {
    const typeLabel = campaign?.offering_type?.replace(/_/g, " ") ?? "matching";
    redirect(`/campaigns/${campaignId}?error=` + encodeURIComponent(
      `This campaign needs a ${typeLabel} offering. Add one to your storefront, or ask the brand to book another format.`));
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

  if (campaign) {
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    await emailUser({
      userId: campaign.brand_id,
      subject: `New application for "${campaign.title}"`,
      text: `Review it on Clipline: ${site}/campaigns/${campaignId}`,
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
      trackServerEvent("deal_created", app.creator_id, {
        deal_id: dealId,
        source: "campaign",
        campaign_id: campaignId,
        application_id: id,
      });
      const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      await emailUser({
        userId: app.creator_id,
        subject: "Your campaign application was accepted — the deal has started",
        text: `Open it on Clipline: ${site}/deals/${dealId}`,
      });
    }
    redirect(`/deals/${dealId}`);
  }

  // RLS restricts the update to campaigns this brand owns; the update trigger
  // enforces the pending → declined transition.
  const reasonRaw = String(formData.get("decline_reason") ?? "").trim();
  const declineReason = reasonRaw.length > 0 ? reasonRaw.slice(0, 500) : null;

  const { data: declined, error } = await supabase
    .from("campaign_applications")
    .update({ status: "declined", decline_reason: declineReason })
    .eq("id", id)
    .select("creator_id")
    .maybeSingle();
  if (error || !declined) {
    redirect(`/campaigns/${campaignId}?error=` +
      encodeURIComponent(error ? friendlyDbError(error) : "Application not found"));
  }
  redirect(`/campaigns/${campaignId}?saved=1`);
}

export async function bulkDecideApplications(formData: FormData) {
  await requireRole("brand");
  const supabase = await createServerSupabase();
  const campaignId = String(formData.get("campaign_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const ids = formData.getAll("application_ids").map(String).filter(Boolean);
  const reasonRaw = String(formData.get("decline_reason") ?? "").trim();
  const declineReason = reasonRaw.length > 0 ? reasonRaw.slice(0, 500) : null;

  if (ids.length === 0 || (decision !== "accepted" && decision !== "declined")) {
    redirect(`/campaigns/${campaignId}`);
  }

  const errors: string[] = [];

  if (decision === "accepted") {
    for (const id of ids) {
      const { data: dealId, error } = await supabase.rpc("accept_campaign_application", {
        p_application_id: id,
      });
      if (error) errors.push(error.message);
      else {
        const { data: app } = await supabase
          .from("campaign_applications").select("creator_id").eq("id", id).maybeSingle();
        if (app) {
          trackServerEvent("deal_created", app.creator_id, {
            deal_id: dealId,
            source: "campaign",
            campaign_id: campaignId,
            application_id: id,
          });
          const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
          await emailUser({
            userId: app.creator_id,
            subject: "Your campaign application was accepted — the deal has started",
            text: `Open it on Clipline: ${site}/campaigns/${campaignId}`,
          });
        }
      }
    }
  } else {
    for (const id of ids) {
      const { data: declined, error } = await supabase
        .from("campaign_applications")
        .update({ status: "declined", decline_reason: declineReason })
        .eq("id", id)
        .select("creator_id")
        .maybeSingle();
      if (error) errors.push(error.message);
    }
  }

  if (errors.length > 0) {
    redirect(`/campaigns/${campaignId}?error=` +
      encodeURIComponent(`${errors.length} application(s) failed: ${errors[0]}`));
  }
  redirect(`/campaigns/${campaignId}?saved=1`);
}
