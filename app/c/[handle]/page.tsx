import { notFound, redirect } from "next/navigation";
import { getStorefront } from "@/lib/storefront/queries";

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
  youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram",
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
  const { profile, offerings, portfolio, stats } = storefront;

  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold">
          {profile.displayName ?? `@${profile.handle}`}
        </h1>
        <p className="text-gray-600">@{profile.handle}{profile.country ? ` · ${profile.country}` : ""}</p>
        {profile.bio && <p className="mt-3 whitespace-pre-line">{profile.bio}</p>}
        {profile.niches.length > 0 && (
          <ul className="flex flex-wrap gap-2 mt-3">
            {profile.niches.map((n) => (
              <li key={n} className="border rounded-full px-3 py-1 text-sm">{n}</li>
            ))}
          </ul>
        )}
      </header>

      <section className="mb-8">
        <h2 className="text-xl font-medium mb-3">Audience</h2>
        {stats.length === 0 ? (
          <p className="text-gray-600 text-sm border rounded p-4">
            Platform verification pending — stats will appear once this creator
            connects their accounts.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-3">
            {stats.map((s) => (
              <li key={s.platform} className="border rounded p-4">
                <p className="font-medium">{PLATFORM_LABELS[s.platform] ?? s.platform}</p>
                <p className="text-sm text-gray-600">@{s.platformHandle}</p>
                {s.verificationStatus === "verified" && s.followerCount !== null ? (
                  <>
                    <p className="mt-1">{Intl.NumberFormat().format(s.followerCount)} followers</p>
                    {s.avgViews !== null && (
                      <p className="text-sm text-gray-600">{Intl.NumberFormat().format(s.avgViews)} avg views</p>
                    )}
                    {s.lastSyncedAt && (
                      <p className="text-xs text-gray-400 mt-1">
                        Verified · updated {new Date(s.lastSyncedAt).toLocaleDateString()}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">Verification {s.verificationStatus}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-medium mb-3">Offerings</h2>
        {offerings.length === 0 ? (
          <p className="text-gray-600">No offerings listed yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {offerings.map((o) => (
              <li key={o.id} data-offering-id={o.id} className="border rounded p-4">
                <div className="flex justify-between items-baseline gap-4">
                  <span className="font-medium">{o.title}</span>
                  <span className="text-lg">${(o.priceCents / 100).toFixed(2)}</span>
                </div>
                <p className="text-sm text-gray-600">
                  {TYPE_LABELS[o.type] ?? o.type} · delivered in {o.turnaroundDays} days ·{" "}
                  {o.revisionLimit} revision{o.revisionLimit === 1 ? "" : "s"} included
                </p>
                {o.description && <p className="mt-2 text-sm">{o.description}</p>}
                <a href={`/book/${o.id}`} className="inline-block border rounded px-4 py-2 mt-3 text-sm">
                  Book this
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {portfolio.length > 0 && (
        <section>
          <h2 className="text-xl font-medium mb-3">Recent work</h2>
          <ul className="flex flex-col gap-2">
            {portfolio.map((item) => (
              <li key={item.id} className="border rounded p-3">
                <a href={item.mediaUrl} target="_blank" rel="noopener noreferrer" className="underline break-all">
                  {item.caption ?? item.mediaUrl}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
