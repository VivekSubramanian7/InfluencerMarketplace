export const PAGE_SIZE = 12;

// Filter keys allowed into saved_filters.params and back out into URLs —
// whitelisted on save AND on render so a tampered blob can't inject URLs.
export const SAVED_FILTER_KEYS = ["q", "niche", "country", "type", "min_price", "max_price"] as const;

export const OFFERING_TYPES = ["dedicated_video", "integration", "short_form_post", "ugc_video"] as const;
export type OfferingType = (typeof OFFERING_TYPES)[number];

export interface DiscoveryFilters {
  q: string | null;
  niche: string | null;
  country: string | null;
  type: OfferingType | null;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  page: number;
  /** brand-only view split: "new" = never collaborated, "worked" = past collaborators */
  tab: "new" | "worked";
}

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function text(v: string | string[] | undefined, maxLen: number): string | null {
  const t = first(v).trim();
  return t.length >= 1 && t.length <= maxLen ? t : null;
}

function wholeDollarsToCents(v: string | string[] | undefined): number | null {
  const s = first(v).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n >= 1 && n <= 1_000_000 ? n * 100 : null;
}

export function parseDiscoveryFilters(
  params: Record<string, string | string[] | undefined>
): DiscoveryFilters {
  const rawType = first(params.type);
  const type = OFFERING_TYPES.includes(rawType as OfferingType)
    ? (rawType as OfferingType)
    : null;

  let minPriceCents = wholeDollarsToCents(params.min_price);
  let maxPriceCents = wholeDollarsToCents(params.max_price);
  if (minPriceCents !== null && maxPriceCents !== null && minPriceCents > maxPriceCents) {
    [minPriceCents, maxPriceCents] = [maxPriceCents, minPriceCents];
  }

  const rawPage = first(params.page);
  const page = /^\d+$/.test(rawPage) && parseInt(rawPage, 10) >= 1
    ? parseInt(rawPage, 10)
    : 1;

  return {
    q: text(params.q, 80),
    niche: text(params.niche, 30)?.toLowerCase() ?? null,
    country: text(params.country, 60),
    type,
    minPriceCents,
    maxPriceCents,
    page,
    tab: first(params.tab) === "worked" ? "worked" : "new",
  };
}
