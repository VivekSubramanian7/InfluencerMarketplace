// Socials a creator can register — must stay in sync with the DB
// `public.platform` enum (0002); note lib/portfolio's PlatformKey adds
// "other", which the enum rejects, so it is NOT reused here.

export const SOCIAL_PLATFORMS = ["youtube", "tiktok", "instagram"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
};

export function isSocialPlatform(value: string): value is SocialPlatform {
  return (SOCIAL_PLATFORMS as readonly string[]).includes(value);
}

export interface PublicStats {
  followerCount: number | null;
  avgViews: number | null;
  engagementRate: number | null;
}

export type FetchStatsResult =
  | { ok: true; stats: PublicStats }
  | { ok: false; reason: "not_found" | "provider_error" | "rate_limited" | "missing_key" | "timeout" };
