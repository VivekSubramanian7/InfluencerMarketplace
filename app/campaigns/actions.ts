"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parsePriceCents, parseText } from "@/lib/storefront/validation";
import { friendlyDbError } from "@/lib/errors";

const OFFERING_TYPES = ["dedicated_video", "integration", "short_form_post", "ugc_video"] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseApplyBy(raw: string): { ok: true; value: string | null } | { ok: false } {
  const s = raw.trim();
  if (!s) return { ok: true, value: null };
  if (!DATE_RE.test(s) || Number.isNaN(Date.parse(s))) return { ok: false };
  return { ok: true, value: s };
}

export async function createCampaign(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();

  const title = parseText(String(formData.get("title") ?? ""), 80);
  const description = parseText(String(formData.get("description") ?? ""), 2000);
  const type = String(formData.get("type") ?? "");
  const budgetMin = parsePriceCents(String(formData.get("budget_min") ?? ""));
  const budgetMax = parsePriceCents(String(formData.get("budget_max") ?? ""));
  const applyBy = parseApplyBy(String(formData.get("apply_by") ?? ""));

  if (
    !title || !description ||
    !OFFERING_TYPES.includes(type as (typeof OFFERING_TYPES)[number]) ||
    !budgetMin || !budgetMax || budgetMax < budgetMin || !applyBy.ok
  ) {
    redirect("/campaigns?error=" + encodeURIComponent(
      "Check the form: title (≤80), description (≤2000), budget $1–$1,000,000 with max ≥ min, and a valid apply-by date"));
  }

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      brand_id: user.id,
      title,
      description,
      offering_type: type,
      budget_min_cents: budgetMin,
      budget_max_cents: budgetMax,
      apply_by: applyBy.value,
    })
    .select("id")
    .single();
  if (error || !campaign) {
    const msg = friendlyDbError(error, {
      "42501": "Only brand accounts can start campaigns",
    });
    redirect("/campaigns?error=" + encodeURIComponent(msg));
  }

  redirect(`/campaigns/${campaign.id}`);
}

export async function setCampaignStatus(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status !== "open" && status !== "closed") redirect(`/campaigns/${id}`);

  const { error } = await supabase
    .from("campaigns").update({ status }).eq("id", id).eq("brand_id", user.id);
  if (error) {
    redirect(`/campaigns/${id}?error=` + encodeURIComponent(friendlyDbError(error)));
  }
  redirect(`/campaigns/${id}?saved=1`);
}
