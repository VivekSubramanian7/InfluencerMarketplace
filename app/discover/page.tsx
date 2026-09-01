import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { parseDiscoveryFilters, SAVED_FILTER_KEYS } from "@/lib/discovery/filters";
import { searchCreators, type SearchScope } from "@/lib/discovery/queries";
import { createServerSupabase } from "@/lib/supabase/server";
import { deleteSearch, saveSearch, sendReachouts } from "./actions";
import { SiteNav } from "@/components/site-nav";
import { creatorGradient } from "@/lib/identity/gradient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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
  const params = await searchParams;
  const filters = parseDiscoveryFilters(params);
  const supabase = await createServerSupabase();
  const isBrand = role === "brand";

  // brand context: past collaborators, blocklist, saved searches, preferences
  let scope: SearchScope = {};
  let savedSearches: { id: string; name: string; params: Record<string, string> }[] = [];
  let usedPrefDefaults = false;
  if (isBrand) {
    const [dealRows, blockRows, savedRows, profileRow] = await Promise.all([
      supabase.from("deals").select("creator_id").eq("brand_id", user.id),
      supabase.from("brand_blocklist").select("creator_id").eq("brand_id", user.id),
      supabase
        .from("saved_filters")
        .select("id, name, params")
        .eq("brand_id", user.id)
        .order("created_at"),
      supabase
        .from("brand_profiles")
        .select("pref_niches, pref_types")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    const collaborators = [...new Set((dealRows.data ?? []).map((r) => r.creator_id as string))];
    const blocked = (blockRows.data ?? []).map((r) => r.creator_id as string);
    savedSearches = (savedRows.data ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      params: (r.params ?? {}) as Record<string, string>,
    }));

    // fresh visit with no filters: seed from onboarding preferences
    const hasAnyParam = ["q", "niche", "country", "type", "min_price", "max_price", "tab", "page"]
      .some((k) => params[k] !== undefined);
    if (!hasAnyParam && profileRow.data) {
      const prefs = profileRow.data;
      if (prefs.pref_niches?.[0]) {
        filters.niche = prefs.pref_niches[0];
        usedPrefDefaults = true;
      }
      if (prefs.pref_types?.[0]) {
        filters.type = prefs.pref_types[0];
        usedPrefDefaults = true;
      }
    }

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

  const error = typeof params.error === "string" ? params.error : null;
  const chip =
    "h-10 rounded-full border bg-background px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const tabClass = (active: boolean) =>
    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
    (active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground");

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Find video creators
        </h1>
        <p className="mt-1 text-muted-foreground">
          Real offerings, transparent prices, verified-or-labeled stats.
        </p>

        {error && (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {isBrand && (
          <div className="mt-6 flex items-center gap-1 rounded-full border bg-secondary/50 p-1 w-fit">
            <Link href={tabHref("new")} className={tabClass(filters.tab === "new")}>
              New creators
            </Link>
            <Link href={tabHref("worked")} className={tabClass(filters.tab === "worked")}>
              Worked with
            </Link>
          </div>
        )}

        {/* Search band: Heepsy's filter-chip pattern, Clipline's skin */}
        <form
          method="get"
          className="mt-4 rounded-2xl border bg-secondary/50 p-4"
        >
          {filters.tab === "worked" && <input type="hidden" name="tab" value="worked" />}
          <div className="flex flex-wrap gap-2">
            <Input
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Search by name, handle, or bio"
              aria-label="Search creators"
              className="h-10 min-w-56 flex-1 rounded-full bg-background px-4"
            />
            <Button type="submit" className="h-10 rounded-full px-6">
              Search
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              name="niche"
              defaultValue={filters.niche ?? ""}
              placeholder="Niche · e.g. gaming"
              aria-label="Niche"
              className={`${chip} w-40`}
            />
            <input
              name="country"
              defaultValue={filters.country ?? ""}
              placeholder="Country"
              aria-label="Country"
              className={`${chip} w-36`}
            />
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
            <input
              name="min_price"
              defaultValue={filters.minPriceCents ? filters.minPriceCents / 100 : ""}
              placeholder="Min $"
              inputMode="numeric"
              aria-label="Minimum price"
              className={`${chip} w-24`}
            />
            <input
              name="max_price"
              defaultValue={filters.maxPriceCents ? filters.maxPriceCents / 100 : ""}
              placeholder="Max $"
              inputMode="numeric"
              aria-label="Maximum price"
              className={`${chip} w-24`}
            />
          </div>
          {usedPrefDefaults && (
            <p className="mt-2 text-xs text-muted-foreground">
              Filtered from your brand preferences —{" "}
              <Link href="/discover?tab=new&page=1" className="underline underline-offset-2">
                show everyone
              </Link>
              .
            </p>
          )}
        </form>

        {isBrand && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {savedSearches.map((s) => (
              <span key={s.id} className="flex items-center gap-1 rounded-full border bg-background pl-3 pr-1 py-1 text-sm">
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
            <form action={saveSearch} className="flex items-center gap-2">
              {SAVED_FILTER_KEYS.map((key) => {
                const v = flatParams.get(key);
                return v ? <input key={key} type="hidden" name={key} value={v} /> : null;
              })}
              <Input
                name="name"
                required
                maxLength={40}
                placeholder="Save this search as…"
                aria-label="Saved search name"
                className="h-8 w-44 rounded-full text-sm"
              />
              <Button type="submit" variant="outline" size="sm" className="rounded-full">
                Save
              </Button>
            </form>
          </div>
        )}

        <p className="mt-6 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{total}</span>{" "}
          creator{total === 1 ? "" : "s"}
          {isBrand && filters.tab === "worked" ? " you've worked with" : " found"}
        </p>

        {creators.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed p-12 text-center">
            <p className="text-lg font-semibold">
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
          </div>
        ) : (
          <form action={isBrand && filters.tab === "new" ? sendReachouts : undefined}>
            {isBrand && filters.tab === "new" && (
              <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border bg-secondary/40 px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Tick creators and invite them with your reachout template
                  (set it in{" "}
                  <Link href="/brand/settings" className="font-medium underline underline-offset-2">
                    Brand settings
                  </Link>
                  ).
                </p>
                <Button type="submit" size="sm" className="shrink-0">
                  Invite selected
                </Button>
              </div>
            )}
            <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {creators.map((c) => {
                const initial = (c.displayName ?? c.handle).charAt(0).toUpperCase();
                const gradient = creatorGradient(c.handle);
                return (
                  <li key={c.userId} className="relative">
                    {isBrand && filters.tab === "new" && (
                      <label className="absolute right-3 top-3 z-10 grid size-8 cursor-pointer place-items-center rounded-full bg-white/90 shadow-card">
                        <input
                          type="checkbox"
                          name="creator_id"
                          value={c.userId}
                          aria-label={`Select ${c.displayName ?? c.handle} for reachout`}
                          className="size-4 accent-primary"
                        />
                      </label>
                    )}
                    <Link
                      href={`/c/${c.handle}`}
                      className="group flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
                    >
                      <div
                        aria-hidden
                        className="h-20"
                        style={{ background: gradient.css }}
                      />
                      <div className="-mt-6 flex items-end gap-3 px-5">
                        <span
                          aria-hidden
                          className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-xl font-black shadow-card"
                          style={{ color: gradient.deep }}
                        >
                          {initial}
                        </span>
                        <div className="min-w-0 pb-0.5">
                          <p className="truncate font-bold">
                            {c.displayName ?? `@${c.handle}`}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            @{c.handle}
                            {c.country ? ` · ${c.country}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col px-5 pb-5">
                      {c.bio && (
                        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                          {c.bio}
                        </p>
                      )}
                      {c.niches.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {c.niches.slice(0, 3).map((n) => (
                            <Badge key={n} variant="secondary" className="font-normal">
                              {n}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="mt-auto pt-4 text-sm">
                        {c.minPriceCents !== null ? (
                          <>
                            From{" "}
                            <span className="text-lg font-extrabold tabular-nums text-primary">
                              ${(c.minPriceCents / 100).toFixed(0)}
                            </span>{" "}
                            <span className="text-muted-foreground">
                              · {c.offeringCount} offering{c.offeringCount === 1 ? "" : "s"}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">No offerings listed</span>
                        )}
                      </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
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
      </main>
    </>
  );
}
