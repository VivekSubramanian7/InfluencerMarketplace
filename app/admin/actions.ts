"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseText } from "@/lib/storefront/validation";
import { friendlyDbError } from "@/lib/errors";

export async function resolveDispute(formData: FormData) {
  await requireRole("admin");
  const supabase = await createServerSupabase();
  const dealId = String(formData.get("deal_id") ?? "");
  const raw = String(formData.get("resolution") ?? "");
  if (raw !== "release" && raw !== "refund") {
    redirect(`/admin/deals/${encodeURIComponent(dealId)}?error=` + encodeURIComponent("Unknown resolution"));
  }
  const resolution = raw === "release" ? "resolve_release" : "resolve_refund";

  const { error } = await supabase.rpc("transition_deal", {
    p_deal_id: dealId, p_action: resolution, p_actor_role: "admin", p_payload: {},
  });
  if (error) redirect(`/admin/deals/${dealId}?error=` + encodeURIComponent(friendlyDbError(error)));
  revalidatePath(`/admin/deals/${dealId}`);
  revalidatePath("/admin");
  redirect(`/admin/deals/${dealId}?resolved=1`);
}

export async function resolveReport(formData: FormData) {
  await requireRole("admin");
  const supabase = await createServerSupabase();
  const reportId = String(formData.get("report_id") ?? "");
  const resolution = parseText(String(formData.get("resolution") ?? ""), 500);
  if (!resolution) redirect("/admin?error=" + encodeURIComponent("Write a short resolution note (max 500 chars)"));

  const { error } = await supabase
    .from("reports")
    .update({ resolution, resolved_at: new Date().toISOString() })
    .eq("id", reportId);
  if (error) redirect("/admin?error=" + encodeURIComponent(friendlyDbError(error)));
  revalidatePath("/admin");
  redirect("/admin?saved=1");
}

export async function setCreatorSuspension(formData: FormData) {
  await requireRole("admin");
  const supabase = await createServerSupabase();
  const userId = String(formData.get("user_id") ?? "");
  const suspend = formData.get("suspend") === "true";

  const { data: cp, error: readErr } = await supabase
    .from("creator_profiles").select("handle, status").eq("user_id", userId).maybeSingle();
  if (readErr || !cp) redirect("/admin?error=" + encodeURIComponent(friendlyDbError(readErr)));

  const status = suspend ? "suspended" : "draft"; // unsuspend never silently re-publishes
  const { error } = await supabase
    .from("creator_profiles").update({ status }).eq("user_id", userId);
  if (error) redirect("/admin?error=" + encodeURIComponent(friendlyDbError(error)));

  revalidatePath(`/c/${cp.handle}`);
  revalidatePath("/admin");
  redirect("/admin?saved=1");
}
