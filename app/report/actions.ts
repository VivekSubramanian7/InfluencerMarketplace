"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseText } from "@/lib/storefront/validation";
import { friendlyDbError } from "@/lib/errors";

export async function fileReport(formData: FormData) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const dealId = String(formData.get("deal_id") ?? "").trim() || null;
  const reason = parseText(String(formData.get("reason") ?? ""), 2000);
  const back = dealId ? `/deals/${encodeURIComponent(dealId)}` : "/deals";

  if (!reason) {
    redirect(`/report?deal=${encodeURIComponent(dealId ?? "")}&error=` +
      encodeURIComponent("Describe the problem (max 2000 characters)"));
  }

  const { error } = await supabase
    .from("reports")
    .insert({ reporter_id: user.id, deal_id: dealId, reason });
  if (error) redirect(`/report?deal=${encodeURIComponent(dealId ?? "")}&error=` + encodeURIComponent(friendlyDbError(error)));

  redirect(`${back}?reported=1`);
}
