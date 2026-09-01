"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseText } from "@/lib/storefront/validation";
import { notify } from "@/lib/notify";
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

  const { data: deal } = await supabase
    .from("deals").select("brand_id, creator_id").eq("id", dealId).maybeSingle();
  if (deal) {
    await notify({
      userId: deal.brand_id === user.id ? deal.creator_id : deal.brand_id,
      kind: "message",
      title: "New message on a deal",
      body: body!.slice(0, 200),
      href: `/deals/${dealId}`,
    });
  }

  revalidatePath(`/deals/${dealId}`);
  redirect(`/deals/${dealId}`);
}
