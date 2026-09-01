"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseOptionalText, parseText } from "@/lib/storefront/validation";
import { notify } from "@/lib/notify";
import { friendlyDbError } from "@/lib/errors";

export async function createBooking(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();
  const offeringId = String(formData.get("offering_id") ?? "");

  const goals = parseText(String(formData.get("goals") ?? ""), 2000);
  if (!goals) {
    redirect(`/book/${offeringId}?error=` +
      encodeURIComponent("Tell the creator what success looks like (max 2000 characters)"));
  }
  const product = parseOptionalText(String(formData.get("product_description") ?? ""), 2000);
  const talking = parseOptionalText(String(formData.get("talking_points") ?? ""), 2000);
  if (!product.ok || !talking.ok) {
    redirect(`/book/${offeringId}?error=` +
      encodeURIComponent("Product description and talking points are limited to 2000 characters"));
  }

  const { data: offering, error: oErr } = await supabase
    .from("offerings")
    .select("id, creator_id, type, title, price_cents, currency, revision_limit, active")
    .eq("id", offeringId)
    .maybeSingle();
  if (oErr || !offering || !offering.active) {
    redirect(`/discover?error=` + encodeURIComponent("That offering is no longer available"));
  }

  const { data: deal, error: dErr } = await supabase
    .from("deals")
    .insert({
      brand_id: user.id,
      creator_id: offering.creator_id,
      offering_id: offering.id,
      offering_type: offering.type,
      offering_title: offering.title,
      price_cents: offering.price_cents,
      currency: offering.currency,
      revision_limit: offering.revision_limit,
      payment_mode: "off_platform",
      status: "requested",
    })
    .select("id")
    .single();
  if (dErr || !deal) {
    const msg = friendlyDbError(dErr, {
      "42501": "You can only book as a brand account",
    });
    redirect(`/book/${offeringId}?error=` + encodeURIComponent(msg));
  }

  const { error: bErr } = await supabase.from("briefs").insert({
    deal_id: deal.id,
    goals,
    product_description: product.value,
    talking_points: talking.value,
  });
  if (bErr) {
    redirect(`/deals/${deal.id}?error=` +
      encodeURIComponent("Deal created but the brief failed to save: " + friendlyDbError(bErr)));
  }

  await notify({
    userId: offering.creator_id,
    kind: "booking",
    title: `New booking request: ${offering.title}`,
    href: `/deals/${deal.id}`,
    email: true,
  });

  redirect(`/deals/${deal.id}`);
}
