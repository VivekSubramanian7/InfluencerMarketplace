// Public TikTok/Instagram profile stats via ScrapeCreators (pay-per-request,
// x-api-key header). Parsers are the single defensive seam for response-shape
// drift: unknown in, null out, fixture-tested.

import { FetchStatsResult, PublicStats } from "@/lib/social/types";
import { VideoStat } from "@/lib/social/engagement";

const BASE = "https://api.scrapecreators.com";

function asCount(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Shape: { stats: { followerCount, heart, videoCount, ... }, user: {...} }
export function parseTikTokProfile(json: unknown): PublicStats | null {
  if (typeof json !== "object" || json === null) return null;
  const stats = (json as { stats?: unknown }).stats;
  if (typeof stats !== "object" || stats === null) return null;
  const followerCount = asCount((stats as { followerCount?: unknown }).followerCount);
  if (followerCount === null) return null;
  return { followerCount, avgViews: null, engagementRate: null };
}

// Shape: { data: { user: { edge_followed_by: { count }, ... } } }
export function parseInstagramProfile(json: unknown): PublicStats | null {
  if (typeof json !== "object" || json === null) return null;
  const data = (json as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return null;
  const user = (data as { user?: unknown }).user;
  if (typeof user !== "object" || user === null) return null;
  const edge = (user as { edge_followed_by?: unknown }).edge_followed_by;
  if (typeof edge !== "object" || edge === null) return null;
  const followerCount = asCount((edge as { count?: unknown }).count);
  if (followerCount === null) return null;
  return { followerCount, avgViews: null, engagementRate: null };
}

// Shape: { aweme_list: [{ statistics: { play_count, digg_count,
// comment_count, share_count } }] }
export function parseTikTokVideos(json: unknown): VideoStat[] {
  if (typeof json !== "object" || json === null) return [];
  const list = (json as { aweme_list?: unknown }).aweme_list;
  if (!Array.isArray(list)) return [];
  const out: VideoStat[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const stats = (item as { statistics?: unknown }).statistics;
    if (typeof stats !== "object" || stats === null) continue;
    const s = stats as Record<string, unknown>;
    out.push({
      views: asCount(s.play_count),
      likes: asCount(s.digg_count),
      comments: asCount(s.comment_count),
      shares: asCount(s.share_count),
    });
  }
  return out;
}

// Shape: { items: [{ like_count, comment_count, play_count | ig_play_count,
// media_type }] } — only video posts carry a play count; photo posts are
// excluded from the sample entirely (views stay null → filtered out).
export function parseInstagramPosts(json: unknown): VideoStat[] {
  if (typeof json !== "object" || json === null) return [];
  const items = (json as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  const out: VideoStat[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const p = item as Record<string, unknown>;
    out.push({
      views: asCount(p.play_count) ?? asCount(p.ig_play_count),
      likes: asCount(p.like_count),
      comments: asCount(p.comment_count),
    });
  }
  return out;
}

async function fetchVideoList(
  pathAndQuery: string,
  parse: (json: unknown) => VideoStat[],
  signal?: AbortSignal
): Promise<VideoStat[]> {
  const key = process.env.SCRAPECREATORS_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`${BASE}${pathAndQuery}`, {
      headers: { "x-api-key": key },
      signal,
      cache: "no-store",
    });
    if (!res.ok) return [];
    return parse(await res.json());
  } catch {
    return [];
  }
}

export function fetchTikTokVideos(handle: string, signal?: AbortSignal): Promise<VideoStat[]> {
  return fetchVideoList(
    `/v3/tiktok/profile/videos?handle=${encodeURIComponent(handle)}&sort_by=latest&trim=true`,
    parseTikTokVideos,
    signal
  );
}

export function fetchInstagramVideos(handle: string, signal?: AbortSignal): Promise<VideoStat[]> {
  return fetchVideoList(
    `/v2/instagram/user/posts?handle=${encodeURIComponent(handle)}&trim=true`,
    parseInstagramPosts,
    signal
  );
}

async function fetchProfile(
  path: string,
  handle: string,
  parse: (json: unknown) => PublicStats | null,
  signal?: AbortSignal
): Promise<FetchStatsResult> {
  const key = process.env.SCRAPECREATORS_API_KEY;
  if (!key) return { ok: false, reason: "missing_key" };

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}?handle=${encodeURIComponent(handle)}`, {
      headers: { "x-api-key": key },
      signal,
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, reason: e instanceof DOMException && e.name === "TimeoutError" ? "timeout" : "provider_error" };
  }
  if (res.status === 404) return { ok: false, reason: "not_found" };
  if (res.status === 402 || res.status === 429) return { ok: false, reason: "rate_limited" };
  if (!res.ok) return { ok: false, reason: "provider_error" };

  const stats = parse(await res.json().catch(() => null));
  if (!stats) return { ok: false, reason: "not_found" };
  return { ok: true, stats };
}

export function fetchTikTokStats(handle: string, signal?: AbortSignal) {
  return fetchProfile("/v1/tiktok/profile", handle, parseTikTokProfile, signal);
}

export function fetchInstagramStats(handle: string, signal?: AbortSignal) {
  return fetchProfile("/v1/instagram/profile", handle, parseInstagramProfile, signal);
}
