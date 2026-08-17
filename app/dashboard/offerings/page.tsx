import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { deleteOffering, saveOffering, toggleOffering } from "./actions";

const TYPE_LABELS: Record<string, string> = {
  dedicated_video: "Dedicated video",
  integration: "Integration (60-90s)",
  short_form_post: "Short-form post",
  ugc_video: "UGC video (no posting)",
};

export default async function OfferingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { user } = await requireRole("creator");
  const { error, saved } = await searchParams;
  const supabase = await createServerSupabase();
  const { data: offerings } = await supabase
    .from("offerings")
    .select("id, type, title, description, price_cents, turnaround_days, revision_limit, active")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold mb-4">Your offerings</h1>
      {error && <p className="mb-4 text-red-600">{error}</p>}
      {saved && <p className="mb-4 text-green-700">Saved.</p>}

      <ul className="flex flex-col gap-3 mb-8">
        {(offerings ?? []).map((o) => (
          <li key={o.id} className="border rounded p-4">
            <div className="flex justify-between items-baseline">
              <span className="font-medium">{o.title}</span>
              <span>${(o.price_cents / 100).toFixed(2)}</span>
            </div>
            <p className="text-sm text-gray-600">
              {TYPE_LABELS[o.type] ?? o.type} · {o.turnaround_days}d turnaround ·{" "}
              {o.revision_limit} revisions · {o.active ? "active" : "hidden"}
            </p>
            <div className="flex gap-2 mt-2">
              <form action={toggleOffering}>
                <input type="hidden" name="id" value={o.id} />
                <input type="hidden" name="active" value={o.active ? "false" : "true"} />
                <button className="text-sm underline">{o.active ? "Hide" : "Activate"}</button>
              </form>
              <form action={deleteOffering}>
                <input type="hidden" name="id" value={o.id} />
                <button className="text-sm underline text-red-600">Delete</button>
              </form>
            </div>
          </li>
        ))}
        {(offerings ?? []).length === 0 && (
          <li className="text-gray-600">No offerings yet — add your first below.</li>
        )}
      </ul>

      <h2 className="text-lg font-medium mb-3">Add an offering</h2>
      <form action={saveOffering} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span>Type</span>
          <select name="type" className="border rounded p-2" defaultValue="dedicated_video">
            {Object.entries(TYPE_LABELS).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span>Title</span>
          <input name="title" className="border rounded p-2" required />
        </label>
        <label className="flex flex-col gap-1">
          <span>Description</span>
          <textarea name="description" rows={3} className="border rounded p-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span>Price (USD)</span>
          <input name="price" inputMode="decimal" className="border rounded p-2" required />
        </label>
        <label className="flex flex-col gap-1">
          <span>Turnaround (days)</span>
          <input name="turnaround_days" type="number" defaultValue={14} className="border rounded p-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span>Included revisions</span>
          <input name="revision_limit" type="number" defaultValue={1} className="border rounded p-2" />
        </label>
        <button className="bg-black text-white rounded p-2">Save offering</button>
      </form>
    </main>
  );
}
