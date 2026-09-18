"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parsePriceCents, parseText, parseOptionalText, parseIntInRange } from "@/lib/storefront/validation";
import { friendlyDbError } from "@/lib/errors";
import { COUNTRIES, LANGUAGES } from "@/lib/constants";

const OFFERING_TYPES = ["dedicated_video", "integration", "short_form_post", "ugc_video"] as const;

const countriesSet = new Set(COUNTRIES);
const languagesSet = new Set(LANGUAGES);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const optionalDate = z.string().trim().transform((v, ctx) => {
  if (!v) return null;
  if (!DATE_RE.test(v) || Number.isNaN(Date.parse(v))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date format" });
    return z.NEVER;
  }
  return v;
});

const campaignSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(80, "Title is too long (max 80 chars)"),
  description: z.string().trim().min(1, "Description is required").max(2000, "Description is too long"),
  type: z.enum(OFFERING_TYPES, { error: "Invalid content type" }),
  is_barter: z.boolean(),
  budget_min: z.string(),
  budget_max: z.string(),
  apply_by: optionalDate,
  product_id: z.string().trim().transform((v) => v || null),
  buyer_persona: z.string().trim().max(1000).transform((v) => v || null),
  target_location: z.array(z.string())
    .transform((arr) => {
      const valid = arr.filter((v) => countriesSet.has(v));
      return valid.length > 0 ? valid.join(", ") : null;
    }),
  target_language: z.string().trim()
    .transform((v) => v || null)
    .refine((v) => v === null || languagesSet.has(v), "Invalid language"),
  content_form: z.string().trim().max(100).transform((v) => v || null),
  script: z.string().trim().max(5000).transform((v) => v || null),
  duration_seconds: z.string().trim().transform((v, ctx) => {
    if (!v) return null;
    const n = parseInt(v, 10);
    if (Number.isNaN(n) || n < 1 || n > 86400) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duration must be 1-86400 seconds" });
      return z.NEVER;
    }
    return n;
  }),
  expected_live_date: optionalDate,
});

function parseApplyBy(raw: string): { ok: true; value: string | null } | { ok: false } {
  const s = raw.trim();
  if (!s) return { ok: true, value: null };
  if (!DATE_RE.test(s) || Number.isNaN(Date.parse(s))) return { ok: false };
  return { ok: true, value: s };
}

export async function createCampaign(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();

  const parsed = campaignSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    type: String(formData.get("type") ?? ""),
    is_barter: formData.get("is_barter") === "on",
    budget_min: String(formData.get("budget_min") ?? ""),
    budget_max: String(formData.get("budget_max") ?? ""),
    apply_by: String(formData.get("apply_by") ?? ""),
    product_id: String(formData.get("product_id") ?? ""),
    buyer_persona: String(formData.get("buyer_persona") ?? ""),
    target_location: formData.getAll("target_location").map(String),
    target_language: String(formData.get("target_language") ?? ""),
    content_form: String(formData.get("content_form") ?? ""),
    script: String(formData.get("script") ?? ""),
    duration_seconds: String(formData.get("duration_seconds") ?? ""),
    expected_live_date: String(formData.get("expected_live_date") ?? ""),
  });

  if (!parsed.success) {
    redirect("/campaigns?error=" + encodeURIComponent(parsed.error.issues[0].message));
  }

  const d = parsed.data;
  const budgetMin = d.is_barter ? 0 : parsePriceCents(d.budget_min);
  const budgetMax = d.is_barter ? 0 : parsePriceCents(d.budget_max);

  if (!d.is_barter && (!budgetMin || !budgetMax || budgetMax < budgetMin)) {
    redirect("/campaigns?error=" + encodeURIComponent("Check the budget fields and try again"));
  }

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      brand_id: user.id,
      title: d.title,
      description: d.description,
      offering_type: d.type,
      budget_min_cents: d.is_barter ? 0 : budgetMin,
      budget_max_cents: d.is_barter ? 0 : budgetMax,
      apply_by: d.apply_by,
      visibility: "public",
      product_id: d.product_id,
      buyer_persona: d.buyer_persona,
      target_location: d.target_location,
      target_language: d.target_language,
      content_form: d.content_form,
      script: d.script,
      duration_seconds: d.duration_seconds,
      is_barter: d.is_barter,
      expected_live_date: d.expected_live_date,
    })
    .select("id")
    .single();
  if (error || !campaign) {
    const msg = friendlyDbError(error, {
      "42501": "Only brand accounts can start campaigns",
    });
    redirect("/campaigns?error=" + encodeURIComponent(msg));
  }

  revalidatePath("/campaigns");
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
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${id}`);
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

  const parsed = campaignSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    type: String(formData.get("type") ?? "dedicated_video"),
    is_barter: formData.get("is_barter") === "on",
    budget_min: String(formData.get("budget_min") ?? ""),
    budget_max: String(formData.get("budget_max") ?? ""),
    apply_by: String(formData.get("apply_by") ?? ""),
    product_id: String(formData.get("product_id") ?? ""),
    buyer_persona: String(formData.get("buyer_persona") ?? ""),
    target_location: formData.getAll("target_location").map(String),
    target_language: String(formData.get("target_language") ?? ""),
    content_form: String(formData.get("content_form") ?? ""),
    script: String(formData.get("script") ?? ""),
    duration_seconds: String(formData.get("duration_seconds") ?? ""),
    expected_live_date: String(formData.get("expected_live_date") ?? ""),
  });

  if (!parsed.success) {
    redirect(`${base}${sep}error=` + encodeURIComponent(parsed.error.issues[0].message));
  }

  const d = parsed.data;
  const budgetMin = d.is_barter ? 0 : parsePriceCents(d.budget_min);
  const budgetMax = d.is_barter ? 0 : parsePriceCents(d.budget_max);

  if (!d.is_barter && (!budgetMin || !budgetMax || budgetMax < budgetMin)) {
    redirect(`${base}${sep}error=` + encodeURIComponent("Check the budget fields and try again"));
  }

  // Fetch current campaign to detect budget/offering_type changes
  const { data: currentCampaign } = await supabase
    .from("campaigns")
    .select("budget_min_cents, budget_max_cents, offering_type")
    .eq("id", id)
    .eq("brand_id", user.id)
    .single();

  const newBudgetMin = d.is_barter ? 0 : budgetMin;
  const newBudgetMax = d.is_barter ? 0 : budgetMax;

  const budgetChanged = currentCampaign &&
    (currentCampaign.budget_min_cents !== newBudgetMin ||
     currentCampaign.budget_max_cents !== newBudgetMax);

  const offeringTypeChanged = currentCampaign &&
    d.type &&
    currentCampaign.offering_type !== d.type;

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
      title: d.title,
      description: d.description,
      budget_min_cents: newBudgetMin,
      budget_max_cents: newBudgetMax,
      apply_by: d.apply_by,
      product_id: d.product_id,
      buyer_persona: d.buyer_persona,
      target_location: d.target_location,
      target_language: d.target_language,
      content_form: d.content_form,
      script: d.script,
      duration_seconds: d.duration_seconds,
      is_barter: d.is_barter,
      expected_live_date: d.expected_live_date,
    })
    .eq("id", id)
    .eq("brand_id", user.id);

  if (error) {
    redirect(`${base}${sep}error=` + encodeURIComponent(friendlyDbError(error)));
  }
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${id}`);
  redirect(`${base}${sep}saved=1`);
}
