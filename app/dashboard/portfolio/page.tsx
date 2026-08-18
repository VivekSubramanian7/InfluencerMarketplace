import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { addPortfolioItem, deletePortfolioItem } from "./actions";
import { SiteNav } from "@/components/site-nav";
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
  const { data: items } = await supabase
    .from("portfolio_items")
    .select("id, media_url, caption")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">Your portfolio</h1>
        <p className="mt-1 text-muted-foreground">
          Link your best videos (YouTube, TikTok, Instagram). Brands see these on your storefront.
        </p>
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

        <ul className="mt-6 mb-10 flex flex-col gap-3">
          {(items ?? []).map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 rounded-xl border p-5">
              <div className="min-w-0">
                <a
                  href={item.media_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-primary underline"
                >
                  {item.media_url}
                </a>
                {item.caption && <p className="text-sm text-muted-foreground">{item.caption}</p>}
              </div>
              <form action={deletePortfolioItem}>
                <input type="hidden" name="id" value={item.id} />
                <Button type="submit" variant="outline" size="sm" className="text-destructive border-destructive/40">
                  Remove
                </Button>
              </form>
            </li>
          ))}
          {(items ?? []).length === 0 && (
            <li className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nothing here yet.
            </li>
          )}
        </ul>

        <form action={addPortfolioItem} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="media_url">Video link</Label>
            <Input id="media_url" name="media_url" type="url" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="caption">Caption (optional)</Label>
            <Input id="caption" name="caption" />
          </div>
          <Button type="submit" className="mt-2">
            Add to portfolio
          </Button>
        </form>
      </main>
    </>
  );
}
