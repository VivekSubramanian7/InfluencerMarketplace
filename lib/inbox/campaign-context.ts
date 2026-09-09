import type { SupabaseClient } from "@supabase/supabase-js";

export type CampaignOfferContext = {
  campaignId: string;
  budgetMaxCents: number;
};

export async function campaignOfferContext(
  supabase: SupabaseClient,
  conversationId: string
): Promise<CampaignOfferContext | null> {
  const { data: invite } = await supabase
    .from("campaign_invites")
    .select("campaign_id")
    .eq("conversation_id", conversationId)
    .limit(1)
    .maybeSingle();
  if (!invite?.campaign_id) return null;

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("budget_max_cents")
    .eq("id", invite.campaign_id)
    .maybeSingle();
  if (!campaign) return null;

  return {
    campaignId: invite.campaign_id,
    budgetMaxCents: campaign.budget_max_cents,
  };
}
