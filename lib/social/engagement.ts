// Turn a sample of recent videos into the two storefront metrics:
// avg_views (mean views) and engagement_rate (mean per-view interaction %).
// Per-view engagement keeps the definition uniform across platforms —
// Clipline is a video marketplace, so video posts are the sample that
// matters (Instagram photo posts contribute nothing here).

export interface VideoStat {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares?: number | null;
}

export const VIDEO_SAMPLE_SIZE = 12;

// engagement_rate is stored as numeric(5,2)
const MAX_RATE = 999.99;

export function computeVideoStats(videos: VideoStat[]): {
  avgViews: number | null;
  engagementRate: number | null;
} {
  const sample = videos
    .slice(0, VIDEO_SAMPLE_SIZE)
    .filter((v) => v.views !== null && v.views > 0);
  if (sample.length === 0) return { avgViews: null, engagementRate: null };

  const avgViews = Math.round(
    sample.reduce((sum, v) => sum + (v.views as number), 0) / sample.length
  );

  const rates = sample
    .filter((v) => v.likes !== null || v.comments !== null || (v.shares ?? null) !== null)
    .map(
      (v) =>
        (((v.likes ?? 0) + (v.comments ?? 0) + (v.shares ?? 0)) / (v.views as number)) * 100
    );
  const engagementRate =
    rates.length === 0
      ? null
      : Math.min(
          MAX_RATE,
          Math.round((rates.reduce((s, r) => s + r, 0) / rates.length) * 100) / 100
        );

  return { avgViews, engagementRate };
}
