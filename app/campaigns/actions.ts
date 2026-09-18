"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parsePriceCents, parseText, parseOptionalText, parseIntInRange } from "@/lib/storefront/validation";
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
  const isBarter = formData.get("is_barter") === "on";
  const budgetMin = isBarter ? 0 : parsePriceCents(String(formData.get("budget_min") ?? ""));
  const budgetMax = isBarter ? 0 : parsePriceCents(String(formData.get("budget_max") ?? ""));
  const applyBy = parseApplyBy(String(formData.get("apply_by") ?? ""));

  // New fields
  const productId = String(formData.get("product_id") ?? "").trim() || null;
  const buyerPersona = parseOptionalText(String(formData.get("buyer_persona") ?? ""), 1000);
  const targetLocation = parseOptionalText(String(formData.get("target_location") ?? ""), 200);
  const targetLanguage = parseOptionalText(String(formData.get("target_language") ?? ""), 100);
  const contentForm = parseOptionalText(String(formData.get("content_form") ?? ""), 100);
  const script = parseOptionalText(String(formData.get("script") ?? ""), 5000);
  const durationRaw = String(formData.get("duration_seconds") ?? "").trim();
  const durationSeconds = durationRaw ? parseIntInRange(durationRaw, 1, 86400) : null;
  const expectedLiveDate = parseApplyBy(String(formData.get("expected_live_date") ?? ""));

  if (
    !title || !description ||
    !OFFERING_TYPES.includes(type as (typeof OFFERING_TYPES)[number]) ||
    (!isBarter && (!budgetMin || !budgetMax || budgetMax < budgetMin)) ||
    !applyBy.ok || !buyerPersona.ok || !targetLocation.ok || !targetLanguage.ok ||
    !contentForm.ok || !script.ok || !expectedLiveDate.ok ||
    (durationRaw && durationSeconds === null)
  ) {
    redirect("/campaigns?error=" + encodeURIComponent(
      "Check the form fields and try again"));
  }

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      brand_id: user.id,
      title,
      description,
      offering_type: type,
      budget_min_cents: isBarter ? 0 : budgetMin,
      budget_max_cents: isBarter ? 0 : budgetMax,
      apply_by: applyBy.value,
      visibility: "public",
      product_id: productId,
      buyer_persona: buyerPersona.ok ? buyerPersona.value : null,
      target_location: targetLocation.ok ? targetLocation.value : null,
      target_language: targetLanguage.ok ? targetLanguage.value : null,
      content_form: contentForm.ok ? contentForm.value : null,
      script: script.ok ? script.value : null,
      duration_seconds: durationSeconds,
      is_barter: isBarter,
      expected_live_date: expectedLiveDate.ok ? expectedLiveDate.value : null,
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

function campaignsRedirectBase(returnTo: string, fallback: string) {
  return returnTo.startsWith("/campaigns") ? returnTo : fallback;
}

export async function setCampaignStatus(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const returnTo = String(formData.get("return_to") ?? "");
  const fallback = `/campaigns/${id}`;
  if (status !== "open" && status !== "closed") redirect(campaignsRedirectBase(returnTo, fallback));

  const { error } = await supabase
    .from("campaigns").update({ status }).eq("id", id).eq("brand_id", user.id);
  const base = campaignsRedirectBase(returnTo, fallback);
  const sep = base.includes("?") ? "&" : "?";
  if (error) {
    redirect(`${base}${sep}error=` + encodeURIComponent(friendlyDbError(error)));
  }
  redirect(`${base}${sep}saved=1`);
}

export async function editCampaign(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();
  const id = String(formData.get("id") ?? "");
  const returnTo = String(formData.get("return_to") ?? "");
  const fallback = `/campaigns/${id}`;
  const base = campaignsRedirectBase(returnTo, fallback);
  const sep = base.includes("?") ? "&" : "?";

  const title = parseText(String(formData.get("title") ?? ""), 80);
  const description = parseText(String(formData.get("description") ?? ""), 2000);
  const isBarter = formData.get("is_barter") === "on";
  const budgetMin = isBarter ? 0 : parsePriceCents(String(formData.get("budget_min") ?? ""));
  const budgetMax = isBarter ? 0 : parsePriceCents(String(formData.get("budget_max") ?? ""));
  const applyBy = parseApplyBy(String(formData.get("apply_by") ?? ""));

  // New fields
  const productId = String(formData.get("product_id") ?? "").trim() || null;
  const buyerPersona = parseOptionalText(String(formData.get("buyer_persona") ?? ""), 1000);
  const targetLocation = parseOptionalText(String(formData.get("target_location") ?? ""), 200);
  const targetLanguage = parseOptionalText(String(formData.get("target_language") ?? ""), 100);
  const contentForm = parseOptionalText(String(formData.get("content_form") ?? ""), 100);
  const script = parseOptionalText(String(formData.get("script") ?? ""), 5000);
  const durationRaw = String(formData.get("duration_seconds") ?? "").trim();
  const durationSeconds = durationRaw ? parseIntInRange(durationRaw, 1, 86400) : null;
  const expectedLiveDate = parseApplyBy(String(formData.get("expected_live_date") ?? ""));
  const offeringType = String(formData.get("type") ?? "");

  if (
    !title || !description ||
    (!isBarter && (!budgetMin || !budgetMax || budgetMax < budgetMin)) ||
    !applyBy.ok || !buyerPersona.ok || !targetLocation.ok || !targetLanguage.ok ||
    !contentForm.ok || !script.ok || !expectedLiveDate.ok ||
    (durationRaw && durationSeconds === null)
  ) {
    redirect(`${base}${sep}error=` + encodeURIComponent(
      "Check the form fields and try again"));
  }

  // Fetch current campaign to detect budget/offering_type changes
  const { data: currentCampaign } = await supabase
    .from("campaigns")
    .select("budget_min_cents, budget_max_cents, offering_type")
    .eq("id", id)
    .eq("brand_id", user.id)
    .single();

  const newBudgetMin = isBarter ? 0 : budgetMin;
  const newBudgetMax = isBarter ? 0 : budgetMax;

  // Check if budget or offering_type is being changed
  const budgetChanged = currentCampaign &&
    (currentCampaign.budget_min_cents !== newBudgetMin ||
     currentCampaign.budget_max_cents !== newBudgetMax);

  const offeringTypeChanged = currentCampaign &&
    offeringType &&
    currentCampaign.offering_type !== offeringType;

  // If budget or offering_type is changing, check for pending applications
  if (budgetChanged || offeringTypeChanged) {
    const { count } = await supabase
      .from("campaign_applications")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", id)
      .eq("status", "pending");

    if (count && count > 0) {
      redirect(`${base}${sep}error=` + encodeURIComponent(
        "Cannot change budget or offering type while applications are pending — decline them first"));
    }
  }

  const { error } = await supabase
    .from("campaigns")
    .update({
      title,
      description,
      budget_min_cents: newBudgetMin,
      budget_max_cents: newBudgetMax,
      apply_by: applyBy.value,
      product_id: productId,
      buyer_persona: buyerPersona.ok ? buyerPersona.value : null,
      target_location: targetLocation.ok ? targetLocation.value : null,
      target_language: targetLanguage.ok ? targetLanguage.value : null,
      content_form: contentForm.ok ? contentForm.value : null,
      script: script.ok ? script.value : null,
      duration_seconds: durationSeconds,
      is_barter: isBarter,
      expected_live_date: expectedLiveDate.ok ? expectedLiveDate.value : null,
    })
    .eq("id", id)
    .eq("brand_id", user.id);

  if (error) {
    redirect(`${base}${sep}error=` + encodeURIComponent(friendlyDbError(error)));
  }
  redirect(`${base}${sep}saved=1`);
}
