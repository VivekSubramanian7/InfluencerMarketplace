"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseIntInRange, parsePriceCents, parseText, parseOptionalText } from "@/lib/storefront/validation";

const OFFERING_TYPES = ["dedicated_video", "integration", "short_form_post", "ugc_video"] as const;

async function creatorHandle(supabase: Awaited<ReturnType<typeof createServerSupabase>>, userId: string) {
  const { data } = await supabase
    .from("creator_profiles").select("handle").eq("user_id", userId).maybeSingle();
  return data?.handle as string | undefined;
}

export async function saveOffering(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();

  const handle = await creatorHandle(supabase, user.id);
  if (!handle) redirect("/dashboard?tab=profile&error=" + encodeURIComponent("Create your profile before adding offerings"));

  const type = String(formData.get("type") ?? "");
  const title = parseText(String(formData.get("title") ?? ""), 80);
  const descriptionResult = parseOptionalText(String(formData.get("description") ?? ""), 2000);
  if (!descriptionResult.ok) redirect("/dashboard?tab=offerings?error=" + encodeURIComponent("Description is too long (max 2000 characters)"));
  const description = descriptionResult.ok ? descriptionResult.value : null;
  const priceCents = parsePriceCents(String(formData.get("price") ?? ""));
  const turnaround = parseIntInRange(String(formData.get("turnaround_days") ?? ""), 1, 90);
  const revisions = parseIntInRange(String(formData.get("revision_limit") ?? ""), 0, 5);

  if (!OFFERING_TYPES.includes(type as (typeof OFFERING_TYPES)[number]) || !title || !priceCents || turnaround === null || revisions === null) {
    redirect("/dashboard?tab=offerings?error=" + encodeURIComponent("Check the form: title (≤80), price $1–$1,000,000, turnaround 1–90 days, revisions 0–5"));
  }

  const id = String(formData.get("id") ?? "");
  const row = {
    creator_id: user.id, type, title, description,
    price_cents: priceCents, turnaround_days: turnaround, revision_limit: revisions,
  };
  const { error } = id
    ? await supabase.from("offerings").update(row).eq("id", id).eq("creator_id", user.id)
    : await supabase.from("offerings").insert(row);
  if (error) redirect("/dashboard?tab=offerings?error=" + encodeURIComponent(error.message));

  revalidatePath(`/c/${handle}`);
  redirect("/dashboard?tab=offerings?saved=1");
}

export async function toggleOffering(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";

  const { error } = await supabase
    .from("offerings").update({ active }).eq("id", id).eq("creator_id", user.id);
  if (error) redirect("/dashboard?tab=offerings?error=" + encodeURIComponent(error.message));

  const handle = await creatorHandle(supabase, user.id);
  if (handle) revalidatePath(`/c/${handle}`);
  redirect("/dashboard?tab=offerings?saved=1");
}

export async function deleteOffering(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();
  const id = String(formData.get("id") ?? "");

  const { error } = await supabase
    .from("offerings").delete().eq("id", id).eq("creator_id", user.id);
  if (error) redirect("/dashboard?tab=offerings?error=" + encodeURIComponent(error.message));

  const handle = await creatorHandle(supabase, user.id);
  if (handle) revalidatePath(`/c/${handle}`);
  redirect("/dashboard?tab=offerings?saved=1");
}
