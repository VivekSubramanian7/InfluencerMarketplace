import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { SiteNav } from "@/components/site-nav";
import { resolveDispute } from "../../actions";

export default async function AdminDealPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; resolved?: string }>;
}) {
  const { role } = await requireRole("admin", "/admin");
  const { id } = await params;
  const { error, resolved } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: deal } = await supabase.from("deals").select("*").eq("id", id).maybeSingle();
  if (!deal) notFound();

  const [{ data: brief }, { data: events }, { data: messages }] = await Promise.all([
    supabase.from("briefs").select("goals, product_description, talking_points").eq("deal_id", id).maybeSingle(),
    supabase.from("deal_events").select("action, from_status, to_status, created_at").eq("deal_id", id).order("created_at"),
    supabase.from("messages").select("sender_id, body, created_at").eq("deal_id", id).order("created_at"),
  ]);

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto max-w-2xl p-8">
        <Link href="/admin" className="text-sm underline">← Admin</Link>
        <h1 className="text-2xl font-semibold mt-2 mb-1">{deal.offering_title}</h1>
        <p className="mb-4">
          Status: <span className="font-medium">{deal.status}</span> ·
          ${(deal.price_cents / 100).toFixed(2)} · {deal.payment_mode}
          {deal.marked_paid_at && " · marked paid"}
        </p>
        {error && <p className="mb-4 text-red-600">{error}</p>}
        {resolved && <p className="mb-4 text-green-700">Dispute resolved.</p>}

        {deal.status === "disputed" && (
          <section className="mb-6 border rounded p-4 bg-amber-50">
            <h2 className="font-medium mb-3">Resolve dispute</h2>
            <div className="flex gap-3">
              <form action={resolveDispute}>
                <input type="hidden" name="deal_id" value={deal.id} />
                <input type="hidden" name="resolution" value="release" />
                <button className="bg-black text-white rounded px-4 py-2 text-sm">
                  Release to creator (complete)
                </button>
              </form>
              <form action={resolveDispute}>
                <input type="hidden" name="deal_id" value={deal.id} />
                <input type="hidden" name="resolution" value="refund" />
                <button className="border border-red-300 text-red-700 rounded px-4 py-2 text-sm">
                  Refund brand (cancel)
                </button>
              </form>
            </div>
          </section>
        )}

        {brief && (
          <section className="mb-6 border rounded p-4">
            <h2 className="font-medium mb-2">Brief</h2>
            <p className="text-sm whitespace-pre-line">{brief.goals}</p>
          </section>
        )}

        <section className="mb-6 border rounded p-4">
          <h2 className="font-medium mb-2">Messages ({(messages ?? []).length})</h2>
          <ul className="text-sm flex flex-col gap-2">
            {(messages ?? []).map((m, i) => (
              <li key={i} className="border-b pb-1">
                <span className="text-gray-500">{new Date(m.created_at).toLocaleString()}:</span>{" "}
                <span className="whitespace-pre-line">{m.body}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-medium mb-2">Timeline</h2>
          <ul className="text-sm text-gray-600 flex flex-col gap-1">
            {(events ?? []).map((e, i) => (
              <li key={i}>
                {new Date(e.created_at).toLocaleString()} — {e.action}
                {e.from_status !== e.to_status ? ` (${e.from_status} → ${e.to_status})` : ""}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
