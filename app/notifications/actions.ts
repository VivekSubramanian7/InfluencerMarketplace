"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";

export async function markAllRead() {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  revalidatePath("/notifications");
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
  revalidatePath("/notifications");
}
