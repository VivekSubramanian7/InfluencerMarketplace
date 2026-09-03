"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseSocialHandle, suggestFromProfileUrl } from "@/lib/social/handle";
import { isSocialPlatform, SOCIAL_PLATFORM_LABELS } from "@/lib/social/types";
import { syncAccountBestEffort } from "@/lib/social/sync";
import { friendlyDbError } from "@/lib/errors";
import { trackServerEvent } from "@/lib/analytics";

async function creatorHandle(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string
) {
  const { data } = await supabase
    .from("creator_profiles").select("handle").eq("user_id", userId).maybeSingle();
  return data?.handle as string | undefined;
}

export async function addSocialAccount(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();

  const profileHandle = await creatorHandle(supabase, user.id);
  if (!profileHandle) {
    redirect("/onboarding/profile?error=" + encodeURIComponent("Claim your handle first"));
  }

  const platform = String(formData.get("platform") ?? "");
  if (!isSocialPlatform(platform)) {
    redirect("/onboarding/socials?error=" + encodeURIComponent("Pick a platform"));
  }

  const raw = String(formData.get("handle") ?? "");
  const handle = parseSocialHandle(platform, raw);
  if (!handle) {
    const suggestion = suggestFromProfileUrl(raw);
    const msg = suggestion
      ? `That link looks like a ${SOCIAL_PLATFORM_LABELS[suggestion.platform]} profile — pick ${SOCIAL_PLATFORM_LABELS[suggestion.platform]} in the dropdown to add @${suggestion.handle}`
      : "Enter a valid handle (like @yourname) or a profile link from the selected platform";
    redirect("/onboarding/socials?error=" + encodeURIComponent(msg));
  }

  const { error } = await supabase.rpc("register_social_account", {
    p_platform: platform,
    p_handle: handle,
  });
  if (error) {
    redirect("/onboarding/socials?error=" + encodeURIComponent(friendlyDbError(error)));
  }

  trackServerEvent("onboarding_step_completed", user.id, { step: "socials", platform });

  // Blocking best-effort (≤5s): a detached promise can be frozen on
  // serverless before it finishes. Failure leaves the row pending;
  // refresh-on-view retries later.
  await syncAccountBestEffort(user.id, platform, handle);

  revalidatePath(`/c/${profileHandle}`);
  redirect("/onboarding/socials?added=" + platform);
}

export async function removeSocialAccount(formData: FormData) {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();
  const id = String(formData.get("id") ?? "");

  const { error } = await supabase
    .from("connected_accounts").delete().eq("id", id).eq("creator_id", user.id);
  if (error) {
    redirect("/onboarding/socials?error=" + encodeURIComponent(friendlyDbError(error)));
  }

  const profileHandle = await creatorHandle(supabase, user.id);
  if (profileHandle) revalidatePath(`/c/${profileHandle}`);
  redirect("/onboarding/socials");
}
