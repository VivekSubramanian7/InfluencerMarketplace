// Public channel stats via the official YouTube Data API v3 (free, API key).
// avgViews/engagementRate stay null: the API only exposes lifetime totals,
// which would mislead next to "avg views".

import { FetchStatsResult, PublicStats } from "@/lib/social/types";

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
