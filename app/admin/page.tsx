import Link from "next/link";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { AuthenticatedShell } from "@/components/authenticated-shell";
import { resolveReport, setCreatorSuspension } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { user, role } = await requireRole("admin", "/admin");
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
    <AuthenticatedShell userId={user.id} role={role}>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
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

        <section className="mt-8">
          <h2 className="text-lg font-bold">Disputed deals ({(disputed ?? []).length})</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {(disputed ?? []).map((d) => (
              <li key={d.id}>
                <Link
                  href={`/admin/deals/${d.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border p-5 transition-colors hover:border-primary/40"
                >
                  <span className="flex items-center gap-2">
                    {d.offering_title}
                    <Badge className="bg-amber text-amber-foreground hover:bg-amber">Disputed</Badge>
                  </span>
                  <span className="font-extrabold tabular-nums text-primary">
                    ${(d.price_cents / 100).toFixed(2)}
                  </span>
                </Link>
              </li>
            ))}
            {(disputed ?? []).length === 0 && (
              <li className="text-sm text-muted-foreground">None open.</li>
            )}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold">Open reports ({(reports ?? []).length})</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {(reports ?? []).map((r) => (
              <li key={r.id} className="rounded-xl border p-5">
                <p className="whitespace-pre-line text-sm">{r.reason}</p>
                {r.deal_id && (
                  <Link className="mt-1 inline-block text-xs text-primary underline" href={`/admin/deals/${r.deal_id}`}>
                    View deal
                  </Link>
                )}
                <form action={resolveReport} className="mt-3 flex gap-2">
                  <input type="hidden" name="report_id" value={r.id} />
                  <Input
                    name="resolution"
                    placeholder="Resolution note"
                    aria-label="Resolution note"
                    required
                    className="flex-1"
                  />
                  <Button type="submit" variant="outline" size="sm">Resolve</Button>
                </form>
              </li>
            ))}
            {(reports ?? []).length === 0 && (
              <li className="text-sm text-muted-foreground">None open.</li>
            )}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold">Creators</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {(creators ?? []).map((c) => (
              <li key={c.user_id} className="flex items-center justify-between rounded-xl border p-5">
                <span className="flex items-center gap-2 text-sm">
                  @{c.handle} <Badge variant="secondary">{c.status}</Badge>
                </span>
                <form action={setCreatorSuspension}>
                  <input type="hidden" name="user_id" value={c.user_id} />
                  <input type="hidden" name="suspend" value={c.status === "suspended" ? "false" : "true"} />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className={c.status === "suspended" ? undefined : "text-destructive border-destructive/40"}
                  >
                    {c.status === "suspended" ? "Unsuspend (to draft)" : "Suspend"}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
    </AuthenticatedShell>
  );
}
