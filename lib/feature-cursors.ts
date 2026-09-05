import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

type UnreadFlags = { inbox: boolean; deals: boolean; campaigns: boolean };

export async function getUnreadFlags(
  userId: string,
  role: "creator" | "brand" | "admin",
): Promise<UnreadFlags> {
  const supabase = await createServerSupabase();

  const { data: cursors } = await supabase
    .from("feature_cursors")
    .select("feature, seen_at")
    .eq("user_id", userId);

  const cursorMap = new Map(
    (cursors ?? []).map((c) => [c.feature, c.seen_at]),
  );

  const since = (feature: string) => cursorMap.get(feature) ?? "1970-01-01T00:00:00Z";

  const inboxP = (async () => {
    const sinceInbox = since("inbox");

    const { count: newMessages } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .not("sender_id", "eq", userId)
      .gt("created_at", sinceInbox)
      .not("conversation_id", "is", null);

    if ((newMessages ?? 0) > 0) return true;

    if (role === "creator") {
      const { count } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", userId)
        .eq("status", "invited")
        .gt("created_at", sinceInbox);
      return (count ?? 0) > 0;
    }

    const { count } = await supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", userId)
      .not("status", "eq", "invited")
      .gt("responded_at", sinceInbox);
    return (count ?? 0) > 0;
  })();

  const dealsP = (async () => {
    const sinceDeals = since("deals");

    const { count: newEvents } = await supabase
      .from("deal_events")
      .select("id", { count: "exact", head: true })
      .not("actor", "eq", userId)
      .gt("created_at", sinceDeals);

    if ((newEvents ?? 0) > 0) return true;

    const { count: newDealMessages } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .not("sender_id", "eq", userId)
      .gt("created_at", sinceDeals)
      .not("deal_id", "is", null);

    return (newDealMessages ?? 0) > 0;
  })();

  const campaignsP = (async () => {
    const sinceCampaigns = since("campaigns");

    if (role === "brand") {
      const { count } = await supabase
        .from("campaign_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .gt("created_at", sinceCampaigns);
      return (count ?? 0) > 0;
    }

    const { count } = await supabase
      .from("campaign_applications")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", userId)
      .in("status", ["accepted", "declined"])
      .gt("created_at", sinceCampaigns);
    return (count ?? 0) > 0;
  })();

  const [inbox, deals, campaigns] = await Promise.all([
    inboxP,
    dealsP,
    campaignsP,
  ]);

  return { inbox, deals, campaigns };
}

export async function touchCursor(feature: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("feature_cursors").upsert(
    { user_id: user.id, feature, seen_at: new Date().toISOString() },
    { onConflict: "user_id,feature" },
  );
}
