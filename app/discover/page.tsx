import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { parseDiscoveryFilters } from "@/lib/discovery/filters";
import { searchCreators } from "@/lib/discovery/queries";
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
  const { role } = await requireUser("/discover");
  const params = await searchParams;
  const filters = parseDiscoveryFilters(params);
  const { creators, total, page, pageSize } = await searchCreators(filters);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const flatParams = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) flatParams.set(k, val);
  }

  if (creators.length === 0 && total > 0 && page > totalPages) {
    redirect(pageHref(flatParams, totalPages));
  }

  const chip =
    "h-10 rounded-full border bg-background px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

        {/* Search band: Heepsy's filter-chip pattern, Clipline's skin */}
        <form
          method="get"
          className="mt-6 rounded-2xl border bg-secondary/50 p-4"
        >
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
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{total}</span>{" "}
          creator{total === 1 ? "" : "s"} found
        </p>

        {creators.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed p-12 text-center">
            <p className="text-lg font-semibold">No creators match those filters yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try widening the price range or clearing a filter.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/discover">Clear all filters</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {creators.map((c) => {
              const initial = (c.displayName ?? c.handle).charAt(0).toUpperCase();
              const gradient = creatorGradient(c.handle);
              return (
                <li key={c.userId}>
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
