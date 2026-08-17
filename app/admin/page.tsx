import Link from "next/link";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { SiteNav } from "@/components/site-nav";
import { resolveReport, setCreatorSuspension } from "./actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { role } = await requireRole("admin", "/admin");
  const { error, saved } = await searchParams;
  const supabase = await createServerSupabase();

  const [{ data: disputed }, { data: reports }, { data: creators }] = await Promise.all([
    supabase.from("deals")
      .select("id, offering_title, price_cents, requested_at")
      .eq("status", "disputed").order("requested_at"),
    supabase.from("reports")
      .select("id, reason, deal_id, created_at")
      .is("resolved_at", null).order("created_at"),
    supabase.from("creator_profiles")
      .select("user_id, handle, status").order("handle"),
  ]);

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold mb-6">Admin</h1>
        {error && <p className="mb-4 text-red-600">{error}</p>}
        {saved && <p className="mb-4 text-green-700">Saved.</p>}

        <section className="mb-8">
          <h2 className="text-lg font-medium mb-3">Disputed deals ({(disputed ?? []).length})</h2>
          <ul className="flex flex-col gap-2">
            {(disputed ?? []).map((d) => (
              <li key={d.id}>
                <Link href={`/admin/deals/${d.id}`} className="border rounded p-3 flex justify-between hover:bg-gray-50">
                  <span>{d.offering_title}</span>
                  <span>${(d.price_cents / 100).toFixed(2)}</span>
                </Link>
              </li>
            ))}
            {(disputed ?? []).length === 0 && <li className="text-sm text-gray-500">None open.</li>}
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-medium mb-3">Open reports ({(reports ?? []).length})</h2>
          <ul className="flex flex-col gap-3">
            {(reports ?? []).map((r) => (
              <li key={r.id} className="border rounded p-4">
                <p className="text-sm whitespace-pre-line mb-1">{r.reason}</p>
                {r.deal_id && (
                  <Link className="text-xs underline" href={`/admin/deals/${r.deal_id}`}>
                    View deal
                  </Link>
                )}
                <form action={resolveReport} className="flex gap-2 mt-2">
                  <input type="hidden" name="report_id" value={r.id} />
                  <input name="resolution" placeholder="Resolution note" required
                    className="border rounded p-2 flex-1 text-sm" />
                  <button className="border rounded px-3 text-sm">Resolve</button>
                </form>
              </li>
            ))}
            {(reports ?? []).length === 0 && <li className="text-sm text-gray-500">None open.</li>}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-medium mb-3">Creators</h2>
          <ul className="flex flex-col gap-2">
            {(creators ?? []).map((c) => (
              <li key={c.user_id} className="border rounded p-3 flex justify-between items-center">
                <span className="text-sm">@{c.handle} · {c.status}</span>
                <form action={setCreatorSuspension}>
                  <input type="hidden" name="user_id" value={c.user_id} />
                  <input type="hidden" name="suspend" value={c.status === "suspended" ? "false" : "true"} />
                  <button className="text-sm underline">
                    {c.status === "suspended" ? "Unsuspend (to draft)" : "Suspend"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
