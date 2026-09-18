import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { parseDiscoveryFilters, SAVED_FILTER_KEYS } from "@/lib/discovery/filters";
import { searchCreators, type SearchScope } from "@/lib/discovery/queries";
import { createServerSupabase } from "@/lib/supabase/server";
import { deleteSearch } from "./actions";
import { inviteToCampaign } from "@/app/campaigns/[id]/invite-actions";
import { BulkInviteWrapper } from "@/components/discover/bulk-invite-wrapper";
import { AuthenticatedShell } from "@/components/authenticated-shell";
import { creatorGradient } from "@/lib/identity/gradient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PriceRange } from "@/components/price-range";
import { SearchSuggest } from "@/components/discover/search-suggest";
import { SearchTracker } from "./search-tracker";
import { COUNTRIES } from "@/lib/constants";

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const TYPE_LABELS: Record<string, string> = {
  dedicated_video: "Dedicated video",
  integration: "Integration (60-90s)",
  short_form_post: "Short-form post",
  ugc_video: "UGC video",
};

function pageHref(params: URLSearchParams, page: number): string {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/discover?${next.toString()}`;
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, role } = await requireUser("/discover");
  const pageLoadedAt = Date.now();
  const params = await searchParams;
  const filters = parseDiscoveryFilters(params);
  const supabase = await createServerSupabase();
  const isBrand = role === "brand";

  // brand context: past collaborators, blocklist, saved searches, preferences
  let scope: SearchScope = {};
  let savedSearches: { id: string; name: string; params: Record<string, string> }[] = [];
  let brandLiveCampaigns: { id: string; title: string }[] = [];
  let capInvites = false;
  if (isBrand) {
    const [dealRows, blockRows, savedRows, campaignRows] = await Promise.all([
      supabase.from("deals").select("creator_id").eq("brand_id", user.id),
      supabase.from("brand_blocklist").select("creator_id").eq("brand_id", user.id),
      supabase
        .from("saved_filters")
        .select("id, name, params")
        .eq("brand_id", user.id)
        .order("created_at"),
      supabase
        .from("campaigns")
        .select("id, title")
        .eq("brand_id", user.id)
        .eq("status", "open")
        .order("created_at", { ascending: false }),
    ]);
    brandLiveCampaigns = (campaignRows.data ?? []).map((r) => ({ id: r.id as string, title: r.title as string }));
    capInvites = typeof params.cap === "string" && params.cap === "invites";
    const collaborators = [...new Set((dealRows.data ?? []).map((r) => r.creator_id as string))];
    const blocked = (blockRows.data ?? []).map((r) => r.creator_id as string);
    savedSearches = (savedRows.data ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      params: (r.params ?? {}) as Record<string, string>,
    }));

    scope =
      filters.tab === "worked"
        ? { onlyIds: collaborators.filter((id) => !blocked.includes(id)) }
        : { excludeIds: [...new Set([...collaborators, ...blocked])] };
  }

  const { creators, total, page, pageSize } = await searchCreators(filters, scope);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const flatParams = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) flatParams.set(k, val);
  }

  if (creators.length === 0 && total > 0 && page > totalPages) {
    redirect(pageHref(flatParams, totalPages));
  }

  const tabHref = (tab: "new" | "worked") => {
    const next = new URLSearchParams(flatParams);
    next.delete("page");
    if (tab === "worked") next.set("tab", "worked");
    else next.delete("tab");
    return `/discover?${next.toString()}`;
  };
  const savedHref = (p: Record<string, string>) => {
    const next = new URLSearchParams();
    for (const key of SAVED_FILTER_KEYS) {
      if (typeof p[key] === "string" && p[key]) next.set(key, p[key].slice(0, 80));
    }
    return `/discover?${next.toString()}`;
  };

  const removeFilterHref = (key: string) => {
    const next = new URLSearchParams(flatParams);
    next.delete(key);
    next.delete("page");
    return `/discover?${next.toString()}`;
  };

  const activeFilters: { key: string; label: string; value: string }[] = [];
  if (filters.q) activeFilters.push({ key: "q", label: "Search", value: filters.q });
  if (filters.niche) activeFilters.push({ key: "niche", label: "Niche", value: filters.niche });
  if (filters.country) activeFilters.push({ key: "country", label: "Country", value: filters.country });
  if (filters.type) activeFilters.push({ key: "type", label: "Format", value: TYPE_LABELS[filters.type] ?? filters.type });
  if (filters.minPriceCents !== null) activeFilters.push({ key: "min_price", label: "Min price", value: `$${filters.minPriceCents / 100}` });
  if (filters.maxPriceCents !== null) activeFilters.push({ key: "max_price", label: "Max price", value: `$${filters.maxPriceCents / 100}` });

  const error = typeof params.error === "string" ? params.error : null;
  const chip =
    "h-10 rounded-full border bg-background px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const tabClass = (active: boolean) =>
    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
    (active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground");

  return (
    <AuthenticatedShell userId={user.id} role={role}>
      <SearchTracker
        query={filters.q}
        filters={{
          niche: filters.niche,
          country: filters.country,
          type: filters.type,
          min_price: filters.minPriceCents?.toString() ?? null,
          max_price: filters.maxPriceCents?.toString() ?? null,
        }}
        totalResults={total}
        page={page}
        pageLoadedAt={pageLoadedAt}
      />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Find video creators
            </h1>
            <p className="mt-1 text-muted-foreground">
              Real offerings, transparent prices, stats verified or labeled.
            </p>
          </div>
          {isBrand && (
            <div className="flex items-center gap-1 rounded-full border bg-secondary/50 p-1">
              <Link href={tabHref("new")} className={tabClass(filters.tab === "new")}>
                New creators
              </Link>
              <Link href={tabHref("worked")} className={tabClass(filters.tab === "worked")}>
                Worked with
              </Link>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* ── Search ── */}
        <form
          key={flatParams.toString()}
          method="get"
          className="mt-6 rounded-[var(--radius-tile)] border border-[var(--border)] p-5"
        >
          {filters.tab === "worked" && <input type="hidden" name="tab" value="worked" />}
          <div className="flex flex-wrap gap-2">
            <SearchSuggest
              defaultValue={filters.q ?? ""}
              recent={
                isBrand
                  ? savedSearches.map((s) => ({ name: s.name, href: savedHref(s.params) }))
                  : []
              }
            />
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <select
              name="country"
              defaultValue={filters.country ?? ""}
              aria-label="Country"
              className={`${chip} w-44 appearance-none`}
            >
              <option value="">Any country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              name="type"
              defaultValue={filters.type ?? ""}
              aria-label="Format"
              className={`${chip} w-44 appearance-none`}
            >
              <option value="">Any format</option>
              {Object.entries(TYPE_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
            <div className="min-w-48 max-w-64 flex-1">
              <PriceRange
                defaultMin={filters.minPriceCents ? filters.minPriceCents / 100 : null}
                defaultMax={filters.maxPriceCents ? filters.maxPriceCents / 100 : null}
              />
            </div>
          </div>
        </form>

        {activeFilters.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {activeFilters.map((f) => (
              <Link
                key={f.key}
                href={removeFilterHref(f.key)}
                className="inline-flex items-center gap-1.5 rounded-full border bg-secondary px-3 py-1 text-sm font-medium transition-colors hover:bg-destructive/10 hover:border-destructive/30"
              >
                {f.value}
                <span aria-hidden className="text-muted-foreground">×</span>
              </Link>
            ))}
            {activeFilters.length > 1 && (
              <Link href="/discover" className="text-xs font-medium text-muted-foreground hover:text-foreground">
                Clear all
              </Link>
            )}
          </div>
        )}

        {isBrand && savedSearches.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {savedSearches.map((s) => (
              <span key={s.id} className="flex items-center gap-1 rounded-full border bg-card pl-3 pr-1 py-1 text-sm shadow-sm">
                <Link href={savedHref(s.params)} className="font-medium hover:underline underline-offset-2">
                  {s.name}
                </Link>
                <form action={deleteSearch}>
                  <input type="hidden" name="id" value={s.id} />
                  <button
                    type="submit"
                    aria-label={`Delete saved search ${s.name}`}
                    className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    ×
                  </button>
                </form>
              </span>
            ))}
          </div>
        )}

        {/* ── Results ── */}
        <div className="mt-8 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{total}</span>{" "}
            creator{total === 1 ? "" : "s"}
            {isBrand && filters.tab === "worked" ? " you've worked with" : " found"}
          </p>
        </div>

        {isBrand && filters.type && (
          <p className="mt-2 text-sm text-muted-foreground">
            Not finding the right fit?{" "}
            <Link
              href={`/campaigns?prefill_type=${filters.type}${filters.niche ? `&prefill_niche=${encodeURIComponent(filters.niche)}` : ""}`}
              className="font-medium underline underline-offset-2 hover:text-foreground"
            >
              Post a campaign
            </Link>{" "}
            and let creators come to you.
          </p>
        )}

        {creators.length === 0 ? (
          <div className="mt-4 rounded-[var(--radius-tile)] border border-dashed p-12 text-center">
            <p className="text-base font-semibold">
              {isBrand && filters.tab === "worked"
                ? "No past collaborators yet."
                : "No creators match those filters yet."}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isBrand && filters.tab === "worked"
                ? "Creators you complete deals with appear here."
                : "Try widening the price range or clearing a filter."}
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/discover">Clear all filters</Link>
            </Button>
            {isBrand && (
              <Button asChild className="mt-2">
                <Link href={`/campaigns?prefill_type=${filters.type ?? ""}${filters.niche ? `&prefill_niche=${encodeURIComponent(filters.niche)}` : ""}`}>
                  Post a campaign instead
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <form id="bulk-invite" action={isBrand && filters.tab === "new" ? inviteToCampaign : undefined}>
            {isBrand && filters.tab === "new" && (
              <div className="sticky top-0 z-10 -mx-6 flex items-center justify-end bg-background/95 px-6 py-2 backdrop-blur-sm">
                <BulkInviteWrapper campaigns={brandLiveCampaigns} formId="bulk-invite" showCapBlocker={capInvites} />
              </div>
            )}
            <div className="mt-4 overflow-x-auto rounded-[var(--radius-tile)] border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--divider)] text-left text-[13px] font-medium text-muted-foreground">
                    {isBrand && filters.tab === "new" && (
                      <th className="w-10 py-2.5 pl-3 pr-1">
                        <span className="sr-only">Select</span>
                      </th>
                    )}
                    <th className="py-2.5 pl-4 pr-2">Creator</th>
                    <th className="px-2 py-2.5">Niches</th>
                    <th className="px-2 py-2.5">Country</th>
                    <th className="px-2 py-2.5 text-right">Followers</th>
                    <th className="px-2 py-2.5 text-right">Avg views</th>
                    <th className="px-2 py-2.5 text-right">Eng.</th>
                    <th className="px-2 py-2.5 text-right">Rating</th>
                    <th className="px-2 py-2.5 text-right">From</th>
                    <th className="px-2 py-2.5 text-right">Offerings</th>
                  </tr>
                </thead>
                <tbody>
                  {creators.map((c) => {
                    const initial = (c.displayName ?? c.handle).charAt(0).toUpperCase();
                    const gradient = creatorGradient(c.handle);
                    return (
                      <tr key={c.userId} className="group border-b border-[var(--divider)] last:border-0 transition-colors hover:bg-[var(--row-hover)]">
                        {isBrand && filters.tab === "new" && (
                          <td className="py-2 pl-3 pr-1 align-middle">
                            <input
                              type="checkbox"
                              name="creator_id"
                              value={c.userId}
                              aria-label={`Select ${c.displayName ?? c.handle}`}
                              className="size-4 accent-primary"
                            />
                          </td>
                        )}
                        <td className="py-2 pl-4 pr-2 align-middle">
                          <Link href={`/c/${c.handle}`} className="flex items-center gap-3 hover:underline underline-offset-2">
                            <span
                              aria-hidden
                              className="grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold"
                              style={{ background: gradient.css, color: gradient.deep }}
                            >
                              {initial}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-medium">
                                {c.displayName ?? `@${c.handle}`}
                                {c.verified && (
                                  <span
                                    title="Verified"
                                    className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-amber/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-foreground align-middle"
                                  >
                                    <span aria-hidden>✓</span> Verified
                                  </span>
                                )}
                              </span>
                              <span className="block truncate text-[13px] text-muted-foreground">@{c.handle}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-2 py-2 align-middle">
                          <div className="flex flex-wrap gap-1">
                            {c.niches.slice(0, 2).map((n) => (
                              <Badge key={n} variant="secondary" className="font-normal text-xs">
                                {n}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-2 py-2 align-middle text-muted-foreground">
                          {c.country ?? "—"}
                        </td>
                        <td className="px-2 py-2 align-middle text-right tabular-nums">
                          {c.followers != null ? fmtK(c.followers) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-2 py-2 align-middle text-right tabular-nums text-muted-foreground">
                          {c.avgViews != null ? fmtK(c.avgViews) : "—"}
                        </td>
                        <td className="px-2 py-2 align-middle text-right tabular-nums text-muted-foreground">
                          {c.engagementRate != null ? `${c.engagementRate.toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-2 py-2 align-middle text-right tabular-nums">
                          {c.avgRating !== null ? (
                            <span>
                              <span className="text-amber" aria-hidden>★</span>{" "}
                              {c.avgRating}
                              <span className="ml-0.5 text-muted-foreground">({c.ratingCount})</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2 align-middle text-right tabular-nums font-semibold">
                          {c.minPriceCents !== null
                            ? `$${(c.minPriceCents / 100).toFixed(0)}`
                            : <span className="font-normal text-muted-foreground">—</span>}
                        </td>
                        <td className="px-2 py-2 align-middle text-right tabular-nums text-muted-foreground">
                          {c.offeringCount || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </form>
        )}

        {totalPages > 1 && (
          <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-5">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(flatParams, page - 1)}>← Previous</Link>
              </Button>
            ) : (
              <span aria-hidden className="w-24" />
            )}
            <span className="text-sm text-muted-foreground tabular-nums">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(flatParams, page + 1)}>Next →</Link>
              </Button>
            ) : (
              <span aria-hidden className="w-24" />
            )}
          </nav>
        )}
    </AuthenticatedShell>
  );
}
