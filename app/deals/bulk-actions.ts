"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
export async function bulkMarkProductSent(formData: FormData) {
  const { user } = await requireRole("brand", "/brand");
  const supabase = await createServerSupabase();
  const dealIds = formData.getAll("deal_ids").map(String).filter(Boolean);
  const returnTo = String(formData.get("return_to") ?? "/brand");

  if (dealIds.length === 0) {
    redirect(returnTo + "?error=" + encodeURIComponent("Select at least one deal"));
  }

  const failures: { dealId: string; error: string }[] = [];
  for (const dealId of dealIds) {
    const { error } = await supabase.rpc("transition_deal", {
      p_deal_id: dealId,
      p_action: "mark_product_sent",
      p_actor_role: "brand",
      p_payload: {},
    });
    if (error) {
      failures.push({ dealId, error: error.message });
    }
  }

  revalidatePath("/brand");
  revalidatePath("/deals");
  if (failures.length > 0) {
    const failedIds = failures.map(f => f.dealId.slice(0, 8)).join(", ");
    const msg = `${failures.length} deal(s) failed: ${failedIds}`;
    redirect(returnTo + "?error=" + encodeURIComponent(msg));
  }
  redirect(returnTo);
}
