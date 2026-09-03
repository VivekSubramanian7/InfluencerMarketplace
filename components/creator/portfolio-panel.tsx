import Link from "next/link";
import { creatorGradient } from "@/lib/identity/gradient";
import { detectPlatform } from "@/lib/portfolio/platform";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface PortfolioItem {
  id: string;
  media_url: string;
  caption: string | null;
}

interface PortfolioPanelProps {
  items: PortfolioItem[];
  addAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
  mode: "wizard" | "settings";
  continueHref?: string;
  handle?: string;
  gradientSeed: string;
  error?: string;
  saved?: string;
}

export function PortfolioPanel({
  items,
  addAction,
  deleteAction,
  mode,
  continueHref,
  handle,
  gradientSeed,
  error,
  saved,
}: PortfolioPanelProps) {
  return (
    <>
      {mode === "settings" && (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className="mt-1 text-muted-foreground">
            Link your best work from YouTube, TikTok, or Instagram. Brands see
            these on your storefront.
          </p>
          {handle && items.length > 0 && (
            <a
              href={`/c/${handle}`}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              See it on your storefront →
            </a>
          )}
        </div>
      )}
      {mode === "wizard" && (
        <p className="mt-2 text-sm text-muted-foreground">
          Link the videos you&apos;re proudest of. They show as your recent work on the storefront.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p className="mt-4 rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
          {mode === "wizard" ? "Highlight added! Add another or continue." : "Saved."}
        </p>
      )}

      {mode === "settings" && (
        <section className="mt-8 rounded-2xl bg-card p-6 shadow-card">
          <h2 className="font-bold">Add a video</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste any video link and we detect the platform automatically.
          </p>
          <form action={addAction} className="mt-4 flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="media_url">Video link</Label>
              <Input id="media_url" name="media_url" type="url" required placeholder="Paste your video link" />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="caption">Caption (optional)</Label>
              <Input id="caption" name="caption" placeholder="What this video shows off" />
            </div>
            <Button type="submit" className="shrink-0">Add to portfolio</Button>
          </form>
        </section>
      )}

      {mode === "settings" ? (
        items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">No videos yet.</p>
            <p className="mt-1">
              Your portfolio is the first thing brands look at. Add your three
              strongest videos to start.
            </p>
          </div>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {items.map((item, i) => {
              const gradient = creatorGradient(`${gradientSeed}-${i}`);
              const platform = detectPlatform(item.media_url);
              let host = item.media_url;
              try { host = new URL(item.media_url).hostname.replace(/^www\./, ""); } catch {}
              return (
                <li key={item.id} className="overflow-hidden rounded-2xl bg-card shadow-card transition-shadow hover:shadow-card-hover">
                  <a href={item.media_url} target="_blank" rel="noopener noreferrer" className="block">
                    <div aria-hidden className="relative h-24" style={{ background: gradient.css, opacity: 0.85 }} />
                    <span className="-mt-4 ml-4 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold shadow-card" style={{ color: gradient.deep }}>
                      {platform.label}
                    </span>
                    <div className="px-4 pt-2">
                      <p className="truncate font-semibold">{item.caption ?? "Watch"}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{host}</p>
                    </div>
                  </a>
                  <div className="flex items-center justify-between px-4 pb-4 pt-3">
                    <a href={item.media_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-muted-foreground hover:text-foreground">Open ↗</a>
                    <form action={deleteAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <Button type="submit" variant="outline" size="sm" className="border-destructive/40 text-destructive">Remove</Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <>
          <ul className="mt-6 flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 rounded-xl border p-4">
                <span className="min-w-0">
                  <Badge variant="secondary">{detectPlatform(item.media_url).label}</Badge>{" "}
                  <span className="break-all text-sm">{item.caption || item.media_url}</span>
                </span>
                <form action={deleteAction} className="shrink-0">
                  <input type="hidden" name="id" value={item.id} />
                  <Button type="submit" variant="outline" size="sm">Remove</Button>
                </form>
              </li>
            ))}
            {items.length === 0 && (
              <li className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No highlights yet. Paste your first video link below.
              </li>
            )}
          </ul>

          <section className="mt-6 rounded-xl border p-5">
            <h2 className="font-bold">Add a highlight</h2>
            <form action={addAction} className="mt-3 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="media_url">Video link</Label>
                <Input id="media_url" name="media_url" required placeholder="https://youtube.com/watch?v=…" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="caption">Caption (optional)</Label>
                <Input id="caption" name="caption" placeholder="Taste-testing every flavor of…" />
              </div>
              <SubmitButton variant="outline" className="self-start" pendingLabel="Adding…">
                Add highlight
              </SubmitButton>
            </form>
          </section>

          {continueHref && (
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
              <p className="text-sm text-muted-foreground">
                {items.length > 0
                  ? `${items.length} ${items.length === 1 ? "highlight" : "highlights"} added`
                  : "Nothing added yet, you can do this later"}
              </p>
              <Button asChild>
                <Link href={continueHref}>Continue → Go live</Link>
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
