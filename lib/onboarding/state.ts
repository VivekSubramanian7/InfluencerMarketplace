// Server-side query for the wizard's derived progress state — the same
// data-existence predicates the dashboard checklist uses.

import { createServerSupabase } from "@/lib/supabase/server";
import { OnboardingState } from "@/lib/onboarding/steps";

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

export async function getOnboardingState(
  supabase: Supabase,
  userId: string
): Promise<OnboardingState & { handle: string | null }> {
  const [profileRes, socialsRes, offeringsRes, portfolioRes] = await Promise.all([
    supabase.from("creator_profiles").select("handle, status").eq("user_id", userId).maybeSingle(),
    supabase.from("connected_accounts").select("id", { count: "exact", head: true }).eq("creator_id", userId),
    supabase.from("offerings").select("id", { count: "exact", head: true }).eq("creator_id", userId),
    supabase.from("portfolio_items").select("id", { count: "exact", head: true }).eq("creator_id", userId),
  ]);

  return {
    hasProfile: !!profileRes.data,
    isLive: profileRes.data?.status === "live",
    handle: profileRes.data?.handle ?? null,
    socialCount: socialsRes.count ?? 0,
    offeringCount: offeringsRes.count ?? 0,
    portfolioCount: portfolioRes.count ?? 0,
  };
}
