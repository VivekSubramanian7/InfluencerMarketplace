// Normalize creator-supplied social handles. Accepts "@handle", a bare
// handle, or a full profile URL — but a URL must belong to the chosen
// platform (a YouTube link pasted under "Instagram" is an error, not a
// silent switch; suggestFromProfileUrl exists for that UX).

import { SocialPlatform } from "@/lib/social/types";

const HANDLE_RE: Record<SocialPlatform, RegExp> = {
  youtube: /^[a-z0-9][a-z0-9._-]{2,29}$/,
  tiktok: /^[a-z0-9][a-z0-9._]{1,23}$/,
  instagram: /^[a-z0-9][a-z0-9._]{0,29}$/,
};

const PLATFORM_HOSTS: Record<SocialPlatform, string[]> = {
  youtube: ["youtube.com"],
  tiktok: ["tiktok.com"],
  instagram: ["instagram.com", "instagr.am"],
};

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith("." + domain);
}

function handleFromUrl(platform: SocialPlatform, url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (!PLATFORM_HOSTS[platform].some((d) => hostMatches(host, d))) return null;
  const segment = url.pathname.split("/").filter(Boolean)[0] ?? "";
  return segment ? segment.replace(/^@/, "") : null;
}

export function parseSocialHandle(platform: SocialPlatform, raw: string): string | null {
  let candidate = raw.trim();
  if (!candidate) return null;

  if (/^https?:\/\//i.test(candidate)) {
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      return null;
    }
    const fromUrl = handleFromUrl(platform, url);
    if (!fromUrl) return null;
    candidate = fromUrl;
  }

  const handle = candidate.replace(/^@/, "").toLowerCase();
  return HANDLE_RE[platform].test(handle) ? handle : null;
}

// For auto-suggesting the platform when a profile URL is pasted into the
// wrong slot. Hosts outside the DB enum return null (no "other" here).
export function suggestFromProfileUrl(
  raw: string
): { platform: SocialPlatform; handle: string } | null {
  if (!/^https?:\/\//i.test(raw.trim())) return null;
  for (const platform of Object.keys(PLATFORM_HOSTS) as SocialPlatform[]) {
    const handle = parseSocialHandle(platform, raw);
    if (handle) return { platform, handle };
  }
  return null;
}
