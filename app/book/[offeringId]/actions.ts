"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseOptionalText, parseText } from "@/lib/storefront/validation";
import { emailUser } from "@/lib/email";
import { friendlyDbError } from "@/lib/errors";
import { trackServerEvent } from "@/lib/analytics";

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

  const { data: dealId, error: dErr } = await supabase.rpc("create_deal", {
    p_brand_id: user.id,
    p_creator_id: offering.creator_id,
    p_offering_id: offering.id,
    p_price_cents: offering.price_cents,
    p_brief: { goals, product_description: product.value, talking_points: talking.value },
    p_source: "booking",
    p_source_meta: {},
    p_initial_status: "requested",
  });
  if (dErr || !dealId) {
    const msg = friendlyDbError(dErr, {
      "42501": "You can only book as a brand account",
    });
    redirect(`/book/${offeringId}?error=` + encodeURIComponent(msg));
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  await emailUser({
    userId: offering.creator_id,
    subject: `New booking request: ${offering.title}`,
    text: `Open it on Clipline: ${site}/deals/${dealId}`,
  });
  trackServerEvent("deal_created", user.id, {
    deal_id: dealId,
    source: "booking",
    offering_title: offering.title,
    price_cents: offering.price_cents,
  });

  redirect(`/deals/${dealId}`);
}
