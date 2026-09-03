"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";

export async function markAllRead(formData?: FormData) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  let query = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  const raw = formData?.get("kinds");
  if (typeof raw === "string" && raw.length > 0) {
    query = query.in("kind", raw.split(","));
  }

  await query;
  revalidatePath("/", "layout");
}

export async function markRead(formData: FormData) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const id = String(formData.get("id") ?? "");
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/", "layout");
}

export async function markReadAndGo(formData: FormData) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const id = String(formData.get("id") ?? "");
  const href = String(formData.get("href") ?? "/notifications");
  if (!href.startsWith("/")) redirect("/notifications");
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/", "layout");
  redirect(href);
}
