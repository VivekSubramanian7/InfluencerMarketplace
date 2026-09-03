"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseIntInRange, parsePriceCents, parseText, parseOptionalText } from "@/lib/storefront/validation";
import { trackServerEvent } from "@/lib/analytics";

const OFFERING_TYPES = ["dedicated_video", "integration", "short_form_post", "ugc_video"] as const;

export async function saveOfferingStep(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();

  const { data: profile } = await supabase
    .from("creator_profiles").select("handle").eq("user_id", user.id).maybeSingle();
  if (!profile) {
    redirect("/onboarding/profile?error=" + encodeURIComponent("Claim your handle first"));
  }

  const type = String(formData.get("type") ?? "");
  const title = parseText(String(formData.get("title") ?? ""), 80);
  const descriptionResult = parseOptionalText(String(formData.get("description") ?? ""), 2000);
  const priceCents = parsePriceCents(String(formData.get("price") ?? ""));
  const turnaround = parseIntInRange(String(formData.get("turnaround_days") ?? ""), 1, 90);
  const revisions = parseIntInRange(String(formData.get("revision_limit") ?? ""), 0, 5);

  if (
    !OFFERING_TYPES.includes(type as (typeof OFFERING_TYPES)[number]) ||
    !title || !descriptionResult.ok || !priceCents || turnaround === null || revisions === null
  ) {
    redirect("/onboarding/offerings?error=" + encodeURIComponent(
      "Check the form: title (≤80), price $1–$1,000,000, turnaround 1–90 days, revisions 0–5"));
  }

  const { error } = await supabase.from("offerings").insert({
    creator_id: user.id, type, title, description: descriptionResult.value,
    price_cents: priceCents, turnaround_days: turnaround, revision_limit: revisions,
  });
  if (error) redirect("/onboarding/offerings?error=" + encodeURIComponent(error.message));

  trackServerEvent("onboarding_step_completed", user.id, {
    step: "offerings",
    type,
    price_cents: priceCents,
  });

  revalidatePath(`/c/${profile.handle}`);
  redirect("/onboarding/offerings?saved=1");
}
