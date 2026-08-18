// Detect which platform a portfolio link points at, from the URL alone.
// No schema change: platform is derived, never stored, so old rows and
// pasted links from new platforms degrade gracefully to "Web".

export type PlatformKey = "youtube" | "tiktok" | "instagram" | "other";

export interface PortfolioPlatform {
  key: PlatformKey;
  label: string;
}

const LABELS: Record<PlatformKey, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  other: "Web",
};

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith("." + domain);
}

export function detectPlatform(url: string): PortfolioPlatform {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return { key: "other", label: LABELS.other };
  }
  let key: PlatformKey = "other";
  if (hostMatches(host, "youtube.com") || hostMatches(host, "youtu.be")) {
    key = "youtube";
  } else if (hostMatches(host, "tiktok.com")) {
    key = "tiktok";
  } else if (hostMatches(host, "instagram.com") || hostMatches(host, "instagr.am")) {
    key = "instagram";
  }
  return { key, label: LABELS[key] };
}
