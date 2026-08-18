import { createPublicClient } from "@/lib/supabase/public";

export interface Storefront {
  profile: {
    userId: string; handle: string; bio: string | null; niches: string[];
    country: string | null; languages: string[];
    displayName: string | null; avatarUrl: string | null;
  };
  offerings: Array<{
    id: string; type: string; title: string; description: string | null;
    priceCents: number; currency: string; turnaroundDays: number; revisionLimit: number;
  }>;
  portfolio: Array<{ id: string; mediaUrl: string; caption: string | null }>;
  stats: Array<{
    platform: string; platformHandle: string; followerCount: number | null;
    avgViews: number | null; engagementRate: number | null;
    verificationStatus: string; lastSyncedAt: string | null;
  }>;
  reviews: Array<{ rating: number; body: string | null; createdAt: string }>;
  avgRating: number | null;
  ratingCount: number;
}

export async function getStorefront(handle: string): Promise<Storefront | null> {
  const supabase = createPublicClient();

  const { data: cp, error: cpError } = await supabase
    .from("creator_profiles")
    .select("user_id, handle, bio, niches, country, languages, status")
    .eq("handle", handle)
    .eq("status", "live")
    .maybeSingle();
  if (cpError) throw new Error("storefront query failed: " + cpError.message);
  if (!cp) return null;

  const [
    { data: prof, error: profError },
    { data: offerings, error: offeringsError },
    { data: portfolio, error: portfolioError },
    { data: stats, error: statsError },
    { data: reviews, error: reviewsError },
    { data: allRatings, error: allRatingsError },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", cp.user_id).maybeSingle(),
    supabase.from("offerings")
      .select("id, type, title, description, price_cents, currency, turnaround_days, revision_limit")
      .eq("creator_id", cp.user_id).eq("active", true).order("price_cents"),
    supabase.from("portfolio_items")
      .select("id, media_url, caption")
      .eq("creator_id", cp.user_id).order("created_at", { ascending: false }),
    supabase.from("public_creator_stats")
      .select("platform, platform_handle, follower_count, avg_views, engagement_rate, verification_status, last_synced_at")
      .eq("creator_id", cp.user_id),
    supabase
      .from("public_creator_reviews")
      .select("rating, body, created_at")
      .eq("creator_id", cp.user_id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("public_creator_reviews")
      .select("rating")
      .eq("creator_id", cp.user_id),
  ]);
  if (profError) throw new Error("storefront query failed: " + profError.message);
  if (offeringsError) throw new Error("storefront query failed: " + offeringsError.message);
  if (portfolioError) throw new Error("storefront query failed: " + portfolioError.message);
  if (statsError) throw new Error("storefront query failed: " + statsError.message);
  if (reviewsError) throw new Error("storefront query failed: " + reviewsError.message);
  if (allRatingsError) throw new Error("storefront rating query failed: " + allRatingsError.message);

  return {
    profile: {
      userId: cp.user_id, handle: cp.handle, bio: cp.bio,
      niches: cp.niches ?? [], country: cp.country, languages: cp.languages ?? [],
      displayName: prof?.display_name ?? null, avatarUrl: prof?.avatar_url ?? null,
    },
    offerings: (offerings ?? []).map((o) => ({
      id: o.id, type: o.type, title: o.title, description: o.description,
      priceCents: o.price_cents, currency: o.currency,
      turnaroundDays: o.turnaround_days, revisionLimit: o.revision_limit,
    })),
    portfolio: (portfolio ?? []).map((p) => ({
      id: p.id, mediaUrl: p.media_url, caption: p.caption,
    })),
    stats: (stats ?? []).map((s) => ({
      platform: s.platform, platformHandle: s.platform_handle,
      followerCount: s.follower_count, avgViews: s.avg_views,
      engagementRate: s.engagement_rate, verificationStatus: s.verification_status,
      lastSyncedAt: s.last_synced_at,
    })),
    reviews: (reviews ?? []).map((r) => ({
      rating: r.rating, body: r.body, createdAt: r.created_at,
    })),
    avgRating: (allRatings ?? []).length > 0
      ? Math.round(((allRatings ?? []).reduce((sum, r) => sum + r.rating, 0) / (allRatings ?? []).length) * 10) / 10
      : null,
    ratingCount: (allRatings ?? []).length,
  };
}
