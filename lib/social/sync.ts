import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchYouTubeStats, fetchYouTubeVideos } from "@/lib/social/providers/youtube";
import {
  fetchTikTokStats,
  fetchInstagramStats,
  fetchTikTokVideos,
  fetchInstagramVideos,
} from "@/lib/social/providers/scrapecreators";
import { computeVideoStats, VideoStat } from "@/lib/social/engagement";
import { isDueForSync, isStale } from "@/lib/social/staleness";
import { FetchStatsResult, SocialPlatform } from "@/lib/social/types";

const PROVIDERS: Record<
  SocialPlatform,
  (handle: string, signal?: AbortSignal) => Promise<FetchStatsResult>
> = {
  youtube: fetchYouTubeStats,
  tiktok: fetchTikTokStats,
  instagram: fetchInstagramStats,
};

// Recent-video fetchers feeding avg_views/engagement_rate. Best effort:
// every fetcher returns [] on any failure, and [] leaves the stored
// values untouched (a follower sync must not wipe video metrics).
const VIDEO_PROVIDERS: Record<
  SocialPlatform,
  (handle: string, signal?: AbortSignal) => Promise<VideoStat[]>
> = {
  youtube: fetchYouTubeVideos,
  tiktok: fetchTikTokVideos,
  instagram: fetchInstagramVideos,
};

// Status semantics (existing check constraint — no schema change):
// - success: write stats + last_synced_at = now(); failed/stale reset to
//   'pending'. Never writes 'verified' and never touches token_ref — both
//   reserved for the future OAuth path.
// - failure: last_synced_at is stamped anyway (it doubles as "last attempt",
//   giving a 7-day backoff; the UI only shows the date next to a real
//   follower count). Never-synced rows go 'failed'; previously synced rows
//   keep their numbers and go 'stale' once older than 14 days.
export async function syncAccount(
  creatorId: string,
  platform: SocialPlatform,
  handle: string,
  opts?: { timeoutMs?: number }
): Promise<{ synced: boolean; reason?: string }> {
  const signal = AbortSignal.timeout(opts?.timeoutMs ?? 5000);
  const result = await PROVIDERS[platform](handle, signal);
  const supabase = createServiceClient();

  // Row may have been deleted or re-pointed at a new handle mid-fetch;
  // scoping the update to the fetched handle makes late writes harmless.
  const scope = { creator_id: creatorId, platform, platform_handle: handle };

  if (result.ok && result.stats.followerCount !== null) {
    const videoStats = computeVideoStats(
      await VIDEO_PROVIDERS[platform](handle, AbortSignal.timeout(opts?.timeoutMs ?? 5000))
    );
    const update: Record<string, unknown> = {
      follower_count: result.stats.followerCount,
      last_synced_at: new Date().toISOString(),
      verification_status: "pending",
    };
    if (videoStats.avgViews !== null) update.avg_views = videoStats.avgViews;
    if (videoStats.engagementRate !== null) update.engagement_rate = videoStats.engagementRate;
    const { error } = await supabase
      .from("connected_accounts")
      .update(update)
      .match(scope)
      .neq("verification_status", "verified");
    if (error) return { synced: false, reason: "db_error: " + error.message };
    return { synced: true };
  }

  const { data: row } = await supabase
    .from("connected_accounts")
    .select("follower_count, last_synced_at, verification_status")
    .match(scope)
    .maybeSingle();
  if (!row) return { synced: false, reason: result.ok ? "hidden_stats" : result.reason };

  const neverSynced = row.follower_count === null;
  const status = neverSynced
    ? "failed"
    : isStale(row.last_synced_at, new Date())
      ? "stale"
      : row.verification_status;
  const { error } = await supabase
    .from("connected_accounts")
    .update({ last_synced_at: new Date().toISOString(), verification_status: status })
    .match(scope)
    .neq("verification_status", "verified");
  if (error) return { synced: false, reason: "db_error: " + error.message };
  return { synced: false, reason: result.ok ? "hidden_stats" : result.reason };
}

// Safe to call before redirect() in a server action: never throws.
export async function syncAccountBestEffort(
  creatorId: string,
  platform: SocialPlatform,
  handle: string
): Promise<void> {
  try {
    await syncAccount(creatorId, platform, handle);
  } catch {
    // row stays pending; retried by refresh-on-view
  }
}

// Refresh-on-view batch: re-sync this creator's due rows. Runs inside
// next/server after() from the storefront page, so it must never throw.
export async function syncDueForCreator(creatorId: string): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { data: rows } = await supabase
      .from("connected_accounts")
      .select("platform, platform_handle, last_synced_at")
      .eq("creator_id", creatorId);
    const due = (rows ?? []).filter((r) => isDueForSync(r.last_synced_at));
    for (const r of due) {
      await syncAccountBestEffort(creatorId, r.platform as SocialPlatform, r.platform_handle);
    }
  } catch {
    // best effort only
  }
}
