// Public channel stats via the official YouTube Data API v3 (free, API key).
// avgViews/engagementRate stay null: the API only exposes lifetime totals,
// which would mislead next to "avg views".

import { FetchStatsResult, PublicStats } from "@/lib/social/types";
import { VideoStat, VIDEO_SAMPLE_SIZE } from "@/lib/social/engagement";

// Defensive: provider JSON is untyped; anything unexpected → null.
export function parseYouTubeChannels(json: unknown): PublicStats | null {
  if (typeof json !== "object" || json === null) return null;
  const items = (json as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length === 0) return null;
  const stats = (items[0] as { statistics?: unknown }).statistics;
  if (typeof stats !== "object" || stats === null) return null;
  const s = stats as { subscriberCount?: unknown; hiddenSubscriberCount?: unknown };
  if (s.hiddenSubscriberCount === true) {
    return { followerCount: null, avgViews: null, engagementRate: null };
  }
  const count = Number(s.subscriberCount);
  if (!Number.isFinite(count) || count < 0) return null;
  return { followerCount: count, avgViews: null, engagementRate: null };
}

export async function fetchYouTubeStats(
  handle: string,
  signal?: AbortSignal
): Promise<FetchStatsResult> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { ok: false, reason: "missing_key" };

  const url =
    "https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=" +
    encodeURIComponent(handle) +
    "&key=" +
    encodeURIComponent(key);

  let res: Response;
  try {
    res = await fetch(url, { signal, cache: "no-store" });
  } catch (e) {
    return { ok: false, reason: e instanceof DOMException && e.name === "TimeoutError" ? "timeout" : "provider_error" };
  }
  if (res.status === 403 || res.status === 429) return { ok: false, reason: "rate_limited" };
  if (!res.ok) return { ok: false, reason: "provider_error" };

  const stats = parseYouTubeChannels(await res.json().catch(() => null));
  if (!stats) return { ok: false, reason: "not_found" };
  return { ok: true, stats };
}

// -- Recent uploads (official API, ~3 quota units per sync) ---------------
// channels.list?part=contentDetails → uploads playlist id
export function parseYouTubeUploadsPlaylist(json: unknown): string | null {
  if (typeof json !== "object" || json === null) return null;
  const items = (json as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length === 0) return null;
  const related = (items[0] as { contentDetails?: { relatedPlaylists?: { uploads?: unknown } } })
    ?.contentDetails?.relatedPlaylists?.uploads;
  return typeof related === "string" && related ? related : null;
}

// playlistItems.list → recent video ids
export function parseYouTubePlaylistItems(json: unknown): string[] {
  if (typeof json !== "object" || json === null) return [];
  const items = (json as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  const ids: string[] = [];
  for (const item of items) {
    const id = (item as { contentDetails?: { videoId?: unknown } })?.contentDetails?.videoId;
    if (typeof id === "string" && id) ids.push(id);
  }
  return ids;
}

// videos.list?part=statistics → per-video stats
export function parseYouTubeVideoStats(json: unknown): VideoStat[] {
  if (typeof json !== "object" || json === null) return [];
  const items = (json as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  const out: VideoStat[] = [];
  for (const item of items) {
    const stats = (item as { statistics?: unknown })?.statistics;
    if (typeof stats !== "object" || stats === null) continue;
    const s = stats as Record<string, unknown>;
    const asCount = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    out.push({
      views: asCount(s.viewCount),
      likes: asCount(s.likeCount),
      comments: asCount(s.commentCount),
    });
  }
  return out;
}

export async function fetchYouTubeVideos(
  handle: string,
  signal?: AbortSignal
): Promise<VideoStat[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  const api = "https://www.googleapis.com/youtube/v3";
  const get = async (pathAndQuery: string): Promise<unknown> => {
    const res = await fetch(`${api}${pathAndQuery}&key=${encodeURIComponent(key)}`, {
      signal,
      cache: "no-store",
    });
    return res.ok ? res.json().catch(() => null) : null;
  };
  try {
    const uploads = parseYouTubeUploadsPlaylist(
      await get(`/channels?part=contentDetails&forHandle=${encodeURIComponent(handle)}`)
    );
    if (!uploads) return [];
    const ids = parseYouTubePlaylistItems(
      await get(
        `/playlistItems?part=contentDetails&maxResults=${VIDEO_SAMPLE_SIZE}&playlistId=${encodeURIComponent(uploads)}`
      )
    );
    if (ids.length === 0) return [];
    return parseYouTubeVideoStats(
      await get(`/videos?part=statistics&id=${ids.map(encodeURIComponent).join(",")}`)
    );
  } catch {
    return [];
  }
}
