"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";

export async function publishStorefront() {
  const { user } = await requireRole("creator");
  const supabase = await createServerSupabase();

  const { data: row, error } = await supabase
    .from("creator_profiles")
    .update({ status: "live" })
    .eq("user_id", user.id)
    .select("handle")
    .maybeSingle();
  if (error || !row) {
    redirect("/onboarding/publish?error=" +
      encodeURIComponent(error?.message ?? "Claim your handle first"));
  }

  revalidatePath(`/c/${row.handle}`);
  redirect("/dashboard?published=1");
}
