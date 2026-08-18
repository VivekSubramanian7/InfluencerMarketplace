import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { addPortfolioItem, deletePortfolioItem } from "./actions";
import { SiteNav } from "@/components/site-nav";
import { creatorGradient } from "@/lib/identity/gradient";
import { detectPlatform } from "@/lib/portfolio/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { user, role } = await requireRole("creator", "/dashboard/portfolio");
  const { error, saved } = await searchParams;
  const supabase = await createServerSupabase();

  const [{ data: items }, { data: profile }] = await Promise.all([
    supabase
      .from("portfolio_items")
      .select("id, media_url, caption")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("creator_profiles")
      .select("handle")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const portfolio = items ?? [];
  const gradientSeed = profile?.handle ?? user.id;

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Your portfolio</h1>
            <p className="mt-1 text-muted-foreground">
              Link your best work from YouTube, TikTok, or Instagram — brands see
              these on your storefront.
            </p>
          </div>
          {profile?.handle && portfolio.length > 0 && (
            <a
              href={`/c/${profile.handle}`}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              See it on your storefront →
            </a>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {saved && (
          <p className="mt-4 rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
            Saved.
          </p>
        )}

        {/* Add form first — the page's one advancing action */}
        <section className="mt-8 rounded-2xl bg-card p-6 shadow-card">
          <h2 className="font-bold">Add a video</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste any video link — we detect the platform automatically.
          </p>
          <form action={addPortfolioItem} className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="media_url">Video link</Label>
              <Input
                id="media_url"
                name="media_url"
                type="url"
                required
                placeholder="https://youtube.com/watch?v=… · tiktok.com/@you/video/… · instagram.com/reel/…"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="caption">Caption (optional)</Label>
              <Input id="caption" name="caption" placeholder="What this video shows off" />
            </div>
            <Button type="submit" className="shrink-0">
              Add to portfolio
            </Button>
          </form>
        </section>

        {portfolio.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">No videos yet.</p>
            <p className="mt-1">
              Your portfolio is the first thing brands look at — add your three
              strongest videos to start.
            </p>
          </div>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {portfolio.map((item, i) => {
              const gradient = creatorGradient(`${gradientSeed}-${i}`);
              const platform = detectPlatform(item.media_url);
              let host = item.media_url;
              try {
                host = new URL(item.media_url).hostname.replace(/^www\./, "");
              } catch {}
              return (
                <li
                  key={item.id}
                  className="overflow-hidden rounded-2xl bg-card shadow-card transition-shadow hover:shadow-card-hover"
                >
                  <a
                    href={item.media_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <div
                      aria-hidden
                      className="relative h-24"
                      style={{ background: gradient.css, opacity: 0.85 }}
                    />
                    <span
                      className="-mt-4 ml-4 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold shadow-card"
                      style={{ color: gradient.deep }}
                    >
                      {platform.label}
                    </span>
                    <div className="px-4 pt-2">
                      <p className="truncate font-semibold">{item.caption ?? "Watch"}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{host}</p>
                    </div>
                  </a>
                  <div className="flex items-center justify-between px-4 pb-4 pt-3">
                    <a
                      href={item.media_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      Open ↗
                    </a>
                    <form action={deletePortfolioItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className="border-destructive/40 text-destructive"
                      >
                        Remove
                      </Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
