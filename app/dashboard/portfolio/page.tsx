import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { addPortfolioItem, deletePortfolioItem } from "./actions";

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { user } = await requireRole("creator");
  const { error, saved } = await searchParams;
  const supabase = await createServerSupabase();
  const { data: items } = await supabase
    .from("portfolio_items")
    .select("id, media_url, caption")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold mb-4">Your portfolio</h1>
      <p className="text-sm text-gray-600 mb-4">
        Link your best videos (YouTube, TikTok, Instagram). Brands see these on your storefront.
      </p>
      {error && <p className="mb-4 text-red-600">{error}</p>}
      {saved && <p className="mb-4 text-green-700">Saved.</p>}

      <ul className="flex flex-col gap-3 mb-8">
        {(items ?? []).map((item) => (
          <li key={item.id} className="border rounded p-4 flex justify-between items-center gap-4">
            <div className="min-w-0">
              <a href={item.media_url} target="_blank" rel="noopener noreferrer" className="underline break-all">
                {item.media_url}
              </a>
              {item.caption && <p className="text-sm text-gray-600">{item.caption}</p>}
            </div>
            <form action={deletePortfolioItem}>
              <input type="hidden" name="id" value={item.id} />
              <button className="text-sm underline text-red-600">Remove</button>
            </form>
          </li>
        ))}
        {(items ?? []).length === 0 && <li className="text-gray-600">Nothing here yet.</li>}
      </ul>

      <form action={addPortfolioItem} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span>Video link</span>
          <input name="media_url" type="url" className="border rounded p-2" required />
        </label>
        <label className="flex flex-col gap-1">
          <span>Caption (optional)</span>
          <input name="caption" className="border rounded p-2" />
        </label>
        <button className="bg-black text-white rounded p-2">Add to portfolio</button>
      </form>
    </main>
  );
}
