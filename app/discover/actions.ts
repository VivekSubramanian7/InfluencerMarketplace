"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseText } from "@/lib/storefront/validation";
import { SAVED_FILTER_KEYS } from "@/lib/discovery/filters";
import { emailUser } from "@/lib/email";
import { friendlyDbError } from "@/lib/errors";
import { trackServerEvent } from "@/lib/analytics";

const DEFAULT_TEMPLATE =
  "Hi! We came across your work and think you'd be a great fit for our brand. " +
  "We'd love to collaborate on a video.";

export async function sendReachouts(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();

  // ponytail: 20 invites per batch keeps reachout deliberate; raise when a
  // real bulk-outreach flow (and anti-spam review) exists.
  const creatorIds = [...new Set(formData.getAll("creator_id").map(String))].slice(0, 20);
  if (creatorIds.length === 0) {
    redirect("/discover?error=" + encodeURIComponent("Select at least one creator to invite"));
  }

  const { data: profile } = await supabase
    .from("brand_profiles")
    .select("outreach_template")
    .eq("user_id", user.id)
    .maybeSingle();
  const message = profile?.outreach_template || DEFAULT_TEMPLATE;

  const { data: me } = await supabase
    .from("brand_profiles").select("company").eq("user_id", user.id).maybeSingle();
  const brandLabel = me?.company || "A brand";

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  // per-row inserts so one duplicate/blocked pair doesn't sink the batch
  let sent = 0;
  let firstError: string | null = null;
  for (const creatorId of creatorIds) {
    const { error } = await supabase.from("conversations").insert({
      brand_id: user.id,
      creator_id: creatorId,
      invite_message: message,
    });
    if (!error) {
      sent++;
      await emailUser({
        userId: creatorId,
        subject: `${brandLabel} wants to work with you`,
        text: `${message}\n\nOpen it on Clipline: ${site}/inbox`,
      });
    } else if (error.code !== "23505" && !firstError) {
      firstError = friendlyDbError(error);
    }
  }

  if (sent === 0) {
    redirect("/discover?error=" +
      encodeURIComponent(firstError ?? "Already invited — check your inbox for those conversations"));
  }
  trackServerEvent("reachouts_sent", user.id, {
    sent_count: sent,
    attempted_count: creatorIds.length,
  });
  redirect(`/inbox?sent=${sent}`);
}

export async function saveSearch(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();

  const name = parseText(String(formData.get("name") ?? ""), 40);
  if (!name) {
    redirect("/discover?error=" + encodeURIComponent("Name the search (up to 40 characters)"));
  }

  const params: Record<string, string> = {};
  for (const key of SAVED_FILTER_KEYS) {
    const v = String(formData.get(key) ?? "").trim();
    if (v) params[key] = v.slice(0, 80);
  }

  const { error } = await supabase
    .from("saved_filters")
    .insert({ brand_id: user.id, name, params });
  if (error) {
    const msg = friendlyDbError(error, {
      "23505": "You already have a saved search with that name",
    });
    redirect("/discover?error=" + encodeURIComponent(msg));
  }

  trackServerEvent("search_saved", user.id, {
    name,
    filter_count: Object.keys(params).length,
  });

  const qs = new URLSearchParams(params);
  qs.set("saved", "1");
  redirect(`/discover?${qs.toString()}`);
}

export async function deleteSearch(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();
  await supabase
    .from("saved_filters")
    .delete()
    .eq("id", String(formData.get("id") ?? ""))
    .eq("brand_id", user.id);
  redirect("/discover");
}
