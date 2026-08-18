import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { SiteNav } from "@/components/site-nav";
import { resolveDispute } from "../../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <Link href="/admin" className="text-sm text-muted-foreground hover:underline">← Admin</Link>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{deal.offering_title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
          Status: <Badge variant="secondary">{deal.status}</Badge> ·
          <span className="font-extrabold tabular-nums text-primary">
            ${(deal.price_cents / 100).toFixed(2)}
          </span>
          · {deal.payment_mode}
          {deal.marked_paid_at && " · marked paid"}
        </p>
        {error && (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {resolved && (
          <p className="mt-4 rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
            Dispute resolved.
          </p>
        )}

        {deal.status === "disputed" && (
          <section className="mt-6 rounded-xl border border-amber bg-amber/15 p-5">
            <h2 className="flex items-center gap-2 text-base font-bold">
              Resolve dispute
              <Badge className="bg-amber text-amber-foreground hover:bg-amber">Disputed</Badge>
            </h2>
            <div className="mt-3 flex gap-3">
              <form action={resolveDispute}>
                <input type="hidden" name="deal_id" value={deal.id} />
                <input type="hidden" name="resolution" value="release" />
                <Button type="submit" size="sm">
                  Release to creator (complete)
                </Button>
              </form>
              <form action={resolveDispute}>
                <input type="hidden" name="deal_id" value={deal.id} />
                <input type="hidden" name="resolution" value="refund" />
                <Button type="submit" variant="outline" size="sm" className="text-destructive border-destructive/40">
                  Refund brand (cancel)
                </Button>
              </form>
            </div>
          </section>
        )}

        {brief && (
          <section className="mt-6 rounded-xl border p-5">
            <h2 className="text-base font-bold">Brief</h2>
            <p className="mt-2 whitespace-pre-line text-sm">{brief.goals}</p>
          </section>
        )}

        <section className="mt-6 rounded-xl border p-5">
          <h2 className="text-base font-bold">Messages ({(messages ?? []).length})</h2>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {(messages ?? []).map((m, i) => (
              <li key={i} className="border-b pb-1">
                <span className="text-muted-foreground">{new Date(m.created_at).toLocaleString()}:</span>{" "}
                <span className="whitespace-pre-line">{m.body}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6">
          <h2 className="text-base font-bold">Timeline</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
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
