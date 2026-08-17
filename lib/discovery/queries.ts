import { createPublicClient } from "@/lib/supabase/public";
import { DiscoveryFilters, PAGE_SIZE } from "@/lib/discovery/filters";

export interface CreatorCard {
  userId: string;
  handle: string;
  displayName: string | null;
  bio: string | null;
  niches: string[];
  country: string | null;
  minPriceCents: number | null;
  offeringCount: number;
}

export async function searchCreators(filters: DiscoveryFilters): Promise<{
  creators: CreatorCard[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const supabase = createPublicClient();

  // Clamp the page before it feeds into range()/from — an unclamped huge
  // page number (or Infinity, if it ever slipped past the parser) would
  // translate into a huge PostgREST offset.
  const page = Math.min(filters.page, 10_000);

  // Offering-level filters resolve to a creator-id allowlist first.
  let creatorIdAllowlist: string[] | null = null;
  if (filters.type || filters.minPriceCents !== null || filters.maxPriceCents !== null) {
    let oq = supabase.from("offerings").select("creator_id").eq("active", true);
    if (filters.type) oq = oq.eq("type", filters.type);
    if (filters.minPriceCents !== null) oq = oq.gte("price_cents", filters.minPriceCents);
    if (filters.maxPriceCents !== null) oq = oq.lte("price_cents", filters.maxPriceCents);
    const { data, error } = await oq;
    if (error) throw new Error("discovery offerings query failed: " + error.message);
    creatorIdAllowlist = [...new Set((data ?? []).map((r) => r.creator_id as string))];
    if (creatorIdAllowlist.length === 0) {
      return { creators: [], total: 0, page, pageSize: PAGE_SIZE };
    }
  }

  let cq = supabase
    .from("creator_profiles")
    .select("user_id, handle, bio, niches, country", { count: "exact" })
    .eq("status", "live");
  if (creatorIdAllowlist) cq = cq.in("user_id", creatorIdAllowlist);
  if (filters.niche) cq = cq.contains("niches", [filters.niche]);
  if (filters.country) cq = cq.ilike("country", filters.country);
  if (filters.q) {
    // filters.q is interpolated into a PostgREST .or() filter string.
    // parseDiscoveryFilters caps its length but does not strip PostgREST
    // syntax characters, so strip them here before building the filter.
    const q = filters.q.replace(/[,().]/g, " ").trim();
    if (q) cq = cq.or(`handle.ilike.%${q}%,bio.ilike.%${q}%`);
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data: rows, count, error } = await cq
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error("discovery creators query failed: " + error.message);

  const ids = (rows ?? []).map((r) => r.user_id as string);
  if (ids.length === 0) {
    return { creators: [], total: count ?? 0, page, pageSize: PAGE_SIZE };
  }

  const [{ data: profiles, error: pErr }, { data: offerings, error: oErr }] = await Promise.all([
    supabase.from("profiles").select("id, display_name").in("id", ids),
    supabase.from("offerings").select("creator_id, price_cents").eq("active", true).in("creator_id", ids),
  ]);
  if (pErr) throw new Error("discovery profiles query failed: " + pErr.message);
  if (oErr) throw new Error("discovery pricing query failed: " + oErr.message);

  const nameById = new Map((profiles ?? []).map((p) => [p.id as string, p.display_name as string | null]));
  const priceStats = new Map<string, { min: number; count: number }>();
  for (const o of offerings ?? []) {
    const cur = priceStats.get(o.creator_id as string);
    const price = o.price_cents as number;
    if (!cur) priceStats.set(o.creator_id as string, { min: price, count: 1 });
    else priceStats.set(o.creator_id as string, { min: Math.min(cur.min, price), count: cur.count + 1 });
  }

  return {
    creators: (rows ?? []).map((r) => ({
      userId: r.user_id as string,
      handle: r.handle as string,
      displayName: nameById.get(r.user_id as string) ?? null,
      bio: (r.bio as string | null),
      niches: (r.niches as string[] | null) ?? [],
      country: (r.country as string | null),
      minPriceCents: priceStats.get(r.user_id as string)?.min ?? null,
      offeringCount: priceStats.get(r.user_id as string)?.count ?? 0,
    })),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  };
}
