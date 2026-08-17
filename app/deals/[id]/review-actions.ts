"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseIntInRange, parseOptionalText } from "@/lib/storefront/validation";

export async function submitReview(formData: FormData) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const dealId = String(formData.get("deal_id") ?? "");

  const rating = parseIntInRange(String(formData.get("rating") ?? ""), 1, 5);
  if (rating === null) {
    redirect(`/deals/${dealId}?error=` + encodeURIComponent("Pick a rating from 1 to 5"));
  }
  const body = parseOptionalText(String(formData.get("body") ?? ""), 1000);
  if (!body.ok) {
    redirect(`/deals/${dealId}?error=` + encodeURIComponent("Review is too long (max 1000 characters)"));
  }

  const { error } = await supabase
    .from("reviews")
    .insert({ deal_id: dealId, author_id: user.id, rating, body: body.value });
  if (error) {
    const msg = error.code === "23505" ? "You already reviewed this deal" : error.message;
    redirect(`/deals/${dealId}?error=` + encodeURIComponent(msg));
  }

  // refresh the reviewed creator's public storefront
  const { data: deal } = await supabase
    .from("deals").select("creator_id").eq("id", dealId).maybeSingle();
  if (deal) {
    const { data: cp } = await supabase
      .from("creator_profiles").select("handle").eq("user_id", deal.creator_id).maybeSingle();
    if (cp?.handle) revalidatePath(`/c/${cp.handle}`);
  }

  revalidatePath(`/deals/${dealId}`);
  redirect(`/deals/${dealId}`);
}
