"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { emailUser } from "@/lib/email";
import { friendlyDbError } from "@/lib/errors";
import { trackServerEvent } from "@/lib/analytics";

const DEFAULT_TEMPLATE =
  "Hi! We came across your work and think you'd be a great fit for our brand. " +
  "We'd love to collaborate on a video.";

export async function inviteFromStorefront(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();
  const creatorId = String(formData.get("creator_id") ?? "");
  const handle = String(formData.get("handle") ?? "");
  const redirectBack = String(formData.get("redirect_to") ?? "") || `/c/${handle}`;

  if (!creatorId) redirect(`/c/${handle}?error=missing`);

  const { data: profile } = await supabase
    .from("brand_profiles")
    .select("outreach_template, company")
    .eq("user_id", user.id)
    .maybeSingle();
  const message = profile?.outreach_template || DEFAULT_TEMPLATE;
  const brandLabel = profile?.company || "A brand";

  const t0 = Date.now();
  const { data: conv, error } = await supabase.from("conversations").insert({
    brand_id: user.id,
    creator_id: creatorId,
    invite_message: message,
  }).select("id").single();
  const duration_ms = Date.now() - t0;

  if (error) {
    if (error.code === "23505") {
      const sep = redirectBack.includes("?") ? "&" : "?";
      redirect(`${redirectBack}${sep}error=${encodeURIComponent("Already invited — check your inbox")}`);
    }
    const sep = redirectBack.includes("?") ? "&" : "?";
    redirect(`${redirectBack}${sep}error=${encodeURIComponent(friendlyDbError(error))}`);
  }

  trackServerEvent("invite_sent", user.id, {
    creator_handle: handle,
    creator_id: creatorId,
    conversation_id: conv.id,
    source: "storefront",
    duration_ms,
  });

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  await emailUser({
    userId: creatorId,
    subject: `${brandLabel} wants to work with you`,
    text: `${message}\n\nOpen it on Clipline: ${site}/inbox`,
  });

  const sep = redirectBack.includes("?") ? "&" : "?";
  redirect(`${redirectBack}${sep}invited=1`);
}
