"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseMediaUrl } from "@/lib/storefront/validation";

const USER_ACTIONS = new Set([
  "accept", "decline", "begin_production", "submit_preview",
  "request_revision", "mark_published", "approve", "cancel", "dispute",
]);

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

  const { error } = await supabase.rpc("transition_deal", {
    p_deal_id: dealId,
    p_action: action,
    p_actor_role: role,
    p_payload: payload,
  });
  if (error) {
    redirect(`/deals/${dealId}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/deals/${dealId}`);
  redirect(`/deals/${dealId}`);
}

export async function markPaid(formData: FormData) {
  await requireUser();
  const supabase = await createServerSupabase();
  const dealId = String(formData.get("deal_id") ?? "");

  const { error } = await supabase.rpc("mark_deal_paid", { p_deal_id: dealId });
  if (error) {
    redirect(`/deals/${dealId}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath(`/deals/${dealId}`);
  redirect(`/deals/${dealId}`);
}
