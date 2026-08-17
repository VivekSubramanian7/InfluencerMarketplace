import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { parseDiscoveryFilters } from "@/lib/discovery/filters";
import { searchCreators } from "@/lib/discovery/queries";

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
  await requireUser();
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

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl font-semibold mb-6">Find video creators</h1>

      <form method="get" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-8">
        <input name="q" defaultValue={filters.q ?? ""} placeholder="Search creators"
          className="border rounded p-2 sm:col-span-2" />
        <input name="niche" defaultValue={filters.niche ?? ""} placeholder="Niche (e.g. gaming)"
          className="border rounded p-2" />
        <input name="country" defaultValue={filters.country ?? ""} placeholder="Country"
          className="border rounded p-2" />
        <select name="type" defaultValue={filters.type ?? ""} className="border rounded p-2">
          <option value="">Any format</option>
          {Object.entries(TYPE_LABELS).map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <input name="min_price" defaultValue={filters.minPriceCents ? filters.minPriceCents / 100 : ""}
            placeholder="Min $" inputMode="numeric" className="border rounded p-2 w-full" />
          <input name="max_price" defaultValue={filters.maxPriceCents ? filters.maxPriceCents / 100 : ""}
            placeholder="Max $" inputMode="numeric" className="border rounded p-2 w-full" />
        </div>
        <button className="bg-black text-white rounded p-2 sm:col-span-3 lg:col-span-6">
          Search
        </button>
      </form>

      <p className="text-sm text-gray-600 mb-4">
        {total} creator{total === 1 ? "" : "s"} found
      </p>

      {creators.length === 0 ? (
        <div className="border rounded p-8 text-center text-gray-600">
          <p className="mb-2">No creators match those filters yet.</p>
          <Link className="underline" href="/discover">Clear filters</Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {creators.map((c) => (
            <li key={c.userId} className="border rounded p-5 flex flex-col gap-2">
              <div>
                <p className="font-medium">{c.displayName ?? `@${c.handle}`}</p>
                <p className="text-sm text-gray-600">
                  @{c.handle}{c.country ? ` · ${c.country}` : ""}
                </p>
              </div>
              {c.bio && <p className="text-sm line-clamp-3">{c.bio}</p>}
              {c.niches.length > 0 && (
                <p className="text-xs text-gray-500">{c.niches.slice(0, 4).join(" · ")}</p>
              )}
              <p className="text-sm mt-auto">
                {c.minPriceCents !== null
                  ? <>From <span className="font-medium">${(c.minPriceCents / 100).toFixed(0)}</span> · {c.offeringCount} offering{c.offeringCount === 1 ? "" : "s"}</>
                  : "No offerings listed"}
              </p>
              <Link href={`/c/${c.handle}`} className="border rounded text-center p-2 mt-1">
                View storefront
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="flex justify-center gap-4 mt-8">
          {page > 1 && (
            <Link className="underline" href={pageHref(flatParams, page - 1)}>← Previous</Link>
          )}
          <span className="text-gray-600">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link className="underline" href={pageHref(flatParams, page + 1)}>Next →</Link>
          )}
        </nav>
      )}
    </main>
  );
}
