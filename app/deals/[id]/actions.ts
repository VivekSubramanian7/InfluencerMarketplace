"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseMediaUrl, parseText } from "@/lib/storefront/validation";
import { notify } from "@/lib/notify";
import { friendlyDbError } from "@/lib/errors";
import { trackServerEvent } from "@/lib/analytics";

const USER_ACTIONS = new Set([
  "accept", "decline", "begin_production", "submit_preview",
  "request_revision", "mark_published", "approve", "cancel", "dispute",
]);

const ACTION_TITLES: Record<string, string> = {
  accept: "Your booking was accepted",
  decline: "Your booking was declined",
  begin_production: "Production has started",
  submit_preview: "A preview is ready for your review",
  request_revision: "Changes were requested on your preview",
  mark_published: "The video is live — verify and approve",
  approve: "Your work was approved",
  cancel: "The deal was cancelled",
  dispute: "The deal was disputed",
};

export async function performDealAction(formData: FormData) {
  const { role } = await requireUser();
  const supabase = await createServerSupabase();
  const dealId = String(formData.get("deal_id") ?? "");
  const action = String(formData.get("action") ?? "");
  const rawUrl = String(formData.get("url") ?? "");

  if (!USER_ACTIONS.has(action) || (role !== "brand" && role !== "creator")) {
    redirect(`/deals/${dealId}?error=` + encodeURIComponent("Unknown action"));
  }

  const payload: Record<string, string> = {};
  if (action === "submit_preview" || action === "mark_published") {
    const url = parseMediaUrl(rawUrl);
    if (!url) {
      redirect(`/deals/${dealId}?error=` +
        encodeURIComponent("A valid http(s) link is required for this step"));
    }
    payload[action === "submit_preview" ? "preview_url" : "live_url"] = url;
  }
  if (action === "request_revision") {
    const note = parseText(String(formData.get("note") ?? ""), 2000);
    if (!note) {
      redirect(`/deals/${dealId}?error=` + encodeURIComponent("Say what to change (max 2000 characters)"));
    }
    payload.revision_note = note;
  }

  const { data: deal, error } = await supabase.rpc("transition_deal", {
    p_deal_id: dealId,
    p_action: action,
    p_actor_role: role,
    p_payload: payload,
  });
  if (error) {
    redirect(`/deals/${dealId}?error=` + encodeURIComponent(friendlyDbError(error)));
  }

  if (action === "request_revision") {
    const note = parseText(String(formData.get("note") ?? ""), 2000);
    if (note) {
      await supabase.from("deals").update({ last_revision_note: note }).eq("id", dealId);
    }
  }

  if (deal) {
    await notify({
      userId: role === "brand" ? deal.creator_id : deal.brand_id,
      kind: "deal",
      title: `${ACTION_TITLES[action] ?? "Deal updated"} · ${deal.offering_title}`,
      href: `/deals/${dealId}`,
      email: true,
    });
    trackServerEvent("deal_state_changed", role === "brand" ? deal.brand_id : deal.creator_id, {
      deal_id: dealId,
      action,
      actor_role: role,
      offering_title: deal.offering_title,
    });
  }

  revalidatePath(`/deals/${dealId}`);
  redirect(`/deals/${dealId}`);
}

export async function markPaid(formData: FormData) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const dealId = String(formData.get("deal_id") ?? "");

  const { error } = await supabase.rpc("mark_deal_paid", { p_deal_id: dealId });
  if (error) {
    redirect(`/deals/${dealId}?error=` + encodeURIComponent(friendlyDbError(error)));
  }
  trackServerEvent("deal_marked_paid", user.id, { deal_id: dealId });
  revalidatePath(`/deals/${dealId}`);
  redirect(`/deals/${dealId}`);
}
