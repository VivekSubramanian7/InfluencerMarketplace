import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStorefront } from "@/lib/storefront/queries";
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
  const { profile, offerings, portfolio, stats, reviews, avgRating } = storefront;
  const initial = (profile.displayName ?? profile.handle).charAt(0).toUpperCase();

  return (
    <>
      {/* Identity band — the creator is the hero */}
      <header className="bg-band text-band-foreground">
        <div className="mx-auto w-full max-w-4xl px-6 pb-10 pt-6">
          <div className="mb-8 flex items-center justify-between text-sm">
            <Link href="/" className="font-extrabold tracking-tight text-white">
              Clipline
            </Link>
            <Link href="/discover" className="text-band-foreground/70 hover:text-white">
              Find more creators
            </Link>
          </div>
          <div className="flex flex-wrap items-end gap-6">
            <span
              aria-hidden
              className="grid size-20 shrink-0 place-items-center rounded-2xl bg-primary text-4xl font-extrabold text-primary-foreground"
            >
              {initial}
            </span>
            <div className="min-w-0">
              <h1 className="text-[clamp(1.8rem,4.5vw,2.8rem)] font-extrabold leading-tight">
                {profile.displayName ?? `@${profile.handle}`}
              </h1>
              <p className="text-band-foreground/70">
                @{profile.handle}
                {profile.country ? ` · ${profile.country}` : ""}
                {avgRating !== null && (
                  <span className="ml-2 font-semibold text-amber">
                    ★ {avgRating}
                  </span>
                )}
              </p>
            </div>
          </div>
          {profile.bio && (
            <p className="mt-5 max-w-[65ch] whitespace-pre-line leading-relaxed text-band-foreground/90">
              {profile.bio}
            </p>
          )}
          {profile.niches.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {profile.niches.map((n) => (
                <li key={n}>
                  <Badge className="border-white/20 bg-white/10 text-band-foreground hover:bg-white/10">
                    {n}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-bold">Audience</h2>
          {stats.length === 0 ? (
            <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
              <span className="mr-2 font-semibold text-foreground">
                Verification pending
              </span>
              Stats appear once this creator connects their platform accounts —
              Clipline never shows unverified numbers.
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-3">
              {stats.map((s) => (
                <li key={s.platform} className="rounded-xl border p-4">
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
                  {s.verificationStatus === "verified" && s.followerCount !== null ? (
                    <>
                      <p className="mt-2 text-2xl font-extrabold tabular-nums">
                        {Intl.NumberFormat("en", { notation: "compact" }).format(s.followerCount)}
                      </p>
                      <p className="text-xs text-muted-foreground">followers</p>
                      {s.avgViews !== null && (
                        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                          {Intl.NumberFormat("en", { notation: "compact" }).format(s.avgViews)}{" "}
                          avg views
                        </p>
                      )}
                      {s.lastSyncedAt && (
                        <p className="mt-1 text-xs text-muted-foreground/70">
                          updated {new Date(s.lastSyncedAt).toLocaleDateString()}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Verification {s.verificationStatus}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-12">
          <h2 className="mb-4 text-xl font-bold">Offerings</h2>
          {offerings.length === 0 ? (
            <p className="text-muted-foreground">No offerings listed yet.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {offerings.map((o) => (
                <li
                  key={o.id}
                  data-offering-id={o.id}
                  className="rounded-xl border p-5 transition-colors hover:border-primary/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold">{o.title}</h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {TYPE_LABELS[o.type] ?? o.type} · {o.turnaroundDays}-day
                        turnaround · {o.revisionLimit} revision
                        {o.revisionLimit === 1 ? "" : "s"} included
                      </p>
                    </div>
                    <span className="text-2xl font-extrabold tabular-nums text-primary">
                      ${(o.priceCents / 100).toFixed(0)}
                    </span>
                  </div>
                  {o.description && (
                    <p className="mt-3 max-w-[65ch] text-sm leading-relaxed">
                      {o.description}
                    </p>
                  )}
                  <Button asChild className="mt-4">
                    <a href={`/book/${o.id}`}>Book this</a>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {reviews.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-4 text-xl font-bold">
              Brand reviews
              {avgRating !== null && (
                <span className="ml-2 text-amber-foreground">
                  <span className="text-amber">★</span> {avgRating}
                </span>
              )}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {reviews.map((r, i) => (
                <li key={i} className="rounded-xl bg-secondary p-5">
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

        {portfolio.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-bold">Recent work</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {portfolio.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl border p-4 transition-colors hover:border-primary/40"
                  >
                    <p className="font-semibold">
                      {item.caption ?? "Watch"}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {item.mediaUrl}
                    </p>
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
