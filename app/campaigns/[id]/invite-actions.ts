"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/errors";
import { inviteRedirect } from "@/lib/campaigns/invite-redirect";
import { trackServerEvent } from "@/lib/analytics";
import { emailUser } from "@/lib/email";
import { sendTelegramMessage } from "@/lib/notifications/telegram";

export async function inviteToCampaign(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();

  const campaignId = String(formData.get("campaign_id") ?? "");
  const creatorIds = [...new Set(formData.getAll("creator_id").map(String))].filter(Boolean).slice(0, 5);
  const redirectTo = String(formData.get("redirect_to") ?? "");

  const errorBase = redirectTo || "/discover";

  if (!campaignId) {
    redirect(`${errorBase}?error=${encodeURIComponent("Select a campaign")}`);
  }
  if (creatorIds.length === 0) {
    redirect(`${errorBase}?error=${encodeURIComponent("Select at least one creator to invite")}`);
  }

  const { data: brandProfile } = await supabase
    .from("brand_profiles")
    .select("company")
    .eq("user_id", user.id)
    .maybeSingle();
  const brandLabel = brandProfile?.company || "A brand";
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  let lastConvId: string | null = null;
  let sent = 0;
  let firstError: string | null = null;

  for (const creatorId of creatorIds) {
    const { data: convId, error } = await supabase.rpc("invite_to_campaign", {
      p_campaign_id: campaignId,
      p_creator_id: creatorId,
    });
    if (!error && convId) {
      sent++;
      lastConvId = convId as string;
      await emailUser({
        userId: creatorId,
        subject: `${brandLabel} invited you to a campaign`,
        text: `You have been invited to a campaign.\n\nOpen it on Clipline: ${site}/inbox?c=${convId}`,
      }).catch(() => {});
    } else if (!firstError) {
      firstError = friendlyDbError(error);
    }
  }

  if (sent === 0) {
    redirect(`${errorBase}?error=${encodeURIComponent(firstError ?? "Could not send invites")}`);
  }

  trackServerEvent("invite_sent", user.id, {
    campaign_id: campaignId,
    sent_count: sent,
    attempted_count: creatorIds.length,
    source: "campaign_invite",
  });

  const { data: campaignRow } = await supabase
    .from("campaigns")
    .select("title")
    .eq("id", campaignId)
    .maybeSingle();
  const campaignTitle = campaignRow?.title ?? "Untitled campaign";

  const { data: creatorRows } = await supabase
    .from("creator_profiles")
    .select("user_id, handle")
    .in("user_id", creatorIds);
  const creatorList = (creatorRows ?? []).map((c) => `@${c.handle}`).join(", ");

  sendTelegramMessage(
    `<b>${brandLabel}</b> invited ${sent} creator${sent === 1 ? "" : "s"} to "<b>${campaignTitle}</b>"\n${creatorList}`
  );

  redirect(inviteRedirect(creatorIds.length === 1 ? lastConvId : null, sent));
}
