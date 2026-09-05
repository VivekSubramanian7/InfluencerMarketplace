"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { trackServerEvent } from "@/lib/analytics";
import { publishDecision } from "@/lib/creators/waitlist";

export async function publishStorefront() {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();

  const { data: accounts } = await supabase
    .from("connected_accounts")
    .select("follower_count")
    .eq("creator_id", user.id);
  const maxFollowers = (accounts ?? []).reduce(
    (max, a) => Math.max(max, a.follower_count ?? 0),
    0
  );
  const status = publishDecision(
    accounts?.length ? maxFollowers : null
  );

  const { data: row, error } = await supabase
    .from("creator_profiles")
    .update({ status })
    .eq("user_id", user.id)
    .select("handle")
    .maybeSingle();
  if (error || !row) {
    redirect("/onboarding/publish?error=" +
      encodeURIComponent(error?.message ?? "Claim your handle first"));
  }

  trackServerEvent("onboarding_completed", user.id, { handle: row.handle, status });

  revalidatePath(`/c/${row.handle}`);
  if (status === "waitlisted") {
    redirect("/dashboard?waitlisted=1");
  }
  redirect("/dashboard?published=1");
}
