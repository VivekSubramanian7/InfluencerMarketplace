"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseText } from "@/lib/storefront/validation";
import { friendlyDbError } from "@/lib/errors";

export async function sendMessage(formData: FormData) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const dealId = String(formData.get("deal_id") ?? "");
  const body = parseText(String(formData.get("body") ?? ""), 5000);
  if (!body) {
    redirect(`/deals/${dealId}?error=` + encodeURIComponent("Message must be 1-5000 characters"));
  }

  const { error } = await supabase
    .from("messages")
    .insert({ deal_id: dealId, sender_id: user.id, body });
  if (error) {
    const msg = friendlyDbError(error, {
      "42501": "You can only message on your own deals",
    });
    redirect(`/deals/${dealId}?error=` + encodeURIComponent(msg));
  }
  revalidatePath(`/deals/${dealId}`);
  redirect(`/deals/${dealId}`);
}
