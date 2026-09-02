import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { getStorefront } from "@/lib/storefront/queries";
import { isDueForSync } from "@/lib/social/staleness";
import { syncDueForCreator } from "@/lib/social/sync";
import { creatorGradient } from "@/lib/identity/gradient";
import { detectPlatform } from "@/lib/portfolio/platform";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const revalidate = 300;

// No handles are known at build time; this opts the route into Next.js's
// static-generation system so unlisted handles are rendered on first
// request and then cached per `revalidate` (dynamicParams defaults to
// true). Without this export, dynamic segments are never eligible for
// ISR and render on every request regardless of `revalidate`.
export async function generateStaticParams() {
  return [];
}

const TYPE_LABELS: Record<string, string> = {
  dedicated_video: "Dedicated video",
  integration: "Integration (60-90s)",
  short_form_post: "Short-form post",
  ugc_video: "UGC video (no posting)",
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
};

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  if (handle !== handle.toLowerCase()) redirect(`/c/${handle.toLowerCase()}`);
  const storefront = await getStorefront(handle.toLowerCase());
  if (!storefront) notFound();
  const { profile, offerings, portfolio, stats, reviews, avgRating, ratingCount } = storefront;
  const initial = (profile.displayName ?? profile.handle).charAt(0).toUpperCase();
  const gradient = creatorGradient(profile.handle);

  // Refresh-on-view: re-sync overdue public stats after the response is
  // sent (never blocks the viewer). ISR (revalidate=300) + the 7-day
  // per-account window in isDueForSync throttle provider calls.
  if (stats.some((s) => isDueForSync(s.lastSyncedAt))) {
    after(() => syncDueForCreator(profile.userId));
  }

  return (
    <>
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-black tracking-tight">
          Clipline
        </Link>
        <Link href="/discover" className="text-sm text-muted-foreground hover:text-foreground">
          Find more creators
        </Link>
      </header>

      <main className={`mx-auto w-full max-w-4xl px-6 pb-12${offerings.length > 0 ? " has-sticky-cta" : ""}`}>
        {/* Gradient identity banner — the creator's own color */}
        <section
          className="relative rounded-3xl p-8 text-white sm:p-11"
          style={{ background: gradient.css }}
        >
          {(ratingCount > 0 || stats.some((s) => s.verificationStatus === "verified")) && (
            <div className="absolute right-6 top-6 rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-foreground shadow-card">
              {ratingCount > 0 && (
                <>
                  {ratingCount} review{ratingCount === 1 ? "" : "s"} ·{" "}
                  <span className="text-amber">★</span> {avgRating}
                </>
              )}
              {ratingCount > 0 &&
                stats.some((s) => s.verificationStatus === "verified") && " · "}
              {stats.some((s) => s.verificationStatus === "verified") && "Verified"}
            </div>
          )}
          <span
            aria-hidden
            className="grid size-18 place-items-center rounded-2xl bg-white/95 text-4xl font-black shadow-card"
            style={{ color: gradient.deep }}
          >
            {initial}
          </span>
          <h1 className="mt-5 text-[clamp(1.9rem,4.5vw,3rem)] font-black leading-tight">
            {profile.displayName ?? `@${profile.handle}`}
          </h1>
          <p className="mt-1 font-medium text-white/85">
            @{profile.handle}
            {profile.country ? ` · ${profile.country}` : ""}
          </p>
          {profile.bio && (
            <p className="mt-4 max-w-[60ch] whitespace-pre-line leading-relaxed text-white/95">
              {profile.bio}
            </p>
          )}
          {profile.niches.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2">
              {profile.niches.map((n) => (
                <li
                  key={n}
                  className="rounded-full bg-white/20 px-3 py-1 text-sm font-medium"
                >
                  {n}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="mb-5 text-xl font-bold">Audience</h2>
          {stats.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              This creator hasn&apos;t linked social accounts yet.
            </div>
          ) : (
            <ul className="card-grid grid gap-4 sm:grid-cols-3">
              {stats.map((s) => (
                <li key={s.platform} className="stat-card rounded-2xl bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover">
                  <div className="flex items-center justify-between">
                    <p className="font-bold">
                      {PLATFORM_LABELS[s.platform] ?? s.platform}
                    </p>
                    {s.verificationStatus === "verified" && (
                      <Badge className="bg-amber text-amber-foreground hover:bg-amber">
                        Verified
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">@{s.platformHandle}</p>
                  {s.followerCount !== null ? (
                    <>
                      <p className="mt-3 text-3xl font-black tabular-nums">
                        {Intl.NumberFormat("en", { notation: "compact" }).format(s.followerCount)}
                      </p>
                      <p className="text-xs text-muted-foreground">followers</p>
                      {s.avgViews !== null && (
                        <p className="mt-2 text-sm text-muted-foreground tabular-nums">
                          {Intl.NumberFormat("en", { notation: "compact" }).format(s.avgViews)}{" "}
                          avg views
                        </p>
                      )}
                      {s.engagementRate !== null && (
                        <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                          {s.engagementRate}% engagement
                        </p>
                      )}
                      {s.lastSyncedAt && (
                        <p className="mt-2 text-xs text-muted-foreground/70">
                          Public stats · updated {new Date(s.lastSyncedAt).toLocaleDateString()}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {s.verificationStatus === "failed" ? "Stats unavailable" : "Stats syncing…"}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="section-divider mt-12" aria-hidden />

        <section className="mt-10">
          <h2 className="mb-5 text-xl font-bold">Offerings</h2>
          {offerings.length === 0 ? (
            <p className="text-muted-foreground">No offerings listed yet.</p>
          ) : (
            <ul className="card-grid flex flex-col gap-4">
              {offerings.map((o) => (
                <li
                  key={o.id}
                  data-offering-id={o.id}
                  className="rounded-2xl bg-card p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold">{o.title}</h3>
                      {avgRating !== null && (
                        <span className="inline-flex items-center gap-1 text-sm">
                          <span className="text-amber">★</span>
                          <span className="font-semibold">{avgRating}</span>
                          <span className="text-muted-foreground">({ratingCount})</span>
                        </span>
                      )}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                        {TYPE_LABELS[o.type] ?? o.type}
                      </span>
                      {o.turnaroundDays}-day turnaround · {o.revisionLimit} revision
                      {o.revisionLimit === 1 ? "" : "s"} included
                    </p>
                  </div>
                  {o.description && (
                    <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
                      {o.description}
                    </p>
                  )}
                  <div className="mt-5">
                    <Button asChild className="px-7">
                      <a href={`/book/${o.id}`}>
                        Book this for ${(o.priceCents / 100).toFixed(0)}
                      </a>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {reviews.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-xl font-bold">
              Brand reviews
              {avgRating !== null && (
                <span className="ml-2">
                  <span className="text-amber">★</span> {avgRating}
                </span>
              )}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {reviews.map((r, i) => (
                <li key={i} className="rounded-2xl bg-secondary p-5">
                  <p aria-label={`${r.rating} out of 5 stars`} className="text-amber">
                    {"★".repeat(r.rating)}
                    <span className="text-border">{"★".repeat(5 - r.rating)}</span>
                  </p>
                  {r.body && (
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
                      {r.body}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {offerings.length > 0 && (() => {
          const cheapest = offerings.reduce((a, b) => a.priceCents < b.priceCents ? a : b);
          return (
            <div className="sticky-cta fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur-md md:hidden">
              <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{cheapest.title}</p>
                  <p className="text-xs text-muted-foreground">
                    From <span className="font-extrabold text-primary">${(cheapest.priceCents / 100).toFixed(0)}</span>
                    {" · "}{cheapest.turnaroundDays}-day delivery
                  </p>
                </div>
                <Button asChild size="sm" className="shrink-0 px-5">
                  <a href={`/book/${cheapest.id}`}>Book now</a>
                </Button>
              </div>
            </div>
          );
        })()}

        {portfolio.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-xl font-bold">Recent work</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {portfolio.map((item, i) => (
                <li key={item.id}>
                  <a
                    href={item.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-2xl bg-card shadow-card transition-shadow hover:shadow-card-hover"
                  >
                    <div
                      aria-hidden
                      className="h-28"
                      style={{
                        background: creatorGradient(`${profile.handle}-${i}`).css,
                        opacity: 0.85,
                      }}
                    />
                    <span
                      className="-mt-4 ml-4 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold shadow-card"
                      style={{ color: creatorGradient(`${profile.handle}-${i}`).deep }}
                    >
                      {detectPlatform(item.mediaUrl).label}
                    </span>
                    <div className="px-4 pb-4 pt-2">
                      <p className="font-semibold">{item.caption ?? "Watch"}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {item.mediaUrl}
                      </p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
