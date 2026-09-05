import Link from "next/link";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { actionsFor } from "@/lib/deals/ui-actions";
import type { DealStatus, PaymentMode } from "@/lib/deals/machine";
import { AuthenticatedShell } from "@/components/authenticated-shell";
import { FilterTokenBar } from "@/components/filters/filter-token-bar";
import { parseFilterTokens } from "@/lib/filters/tokens";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_LABELS: Record<string, string> = {
  requested: "Awaiting creator", funded: "Funded",
  accepted: "Accepted", in_production: "In production",
  submitted: "Preview submitted", revision_requested: "Changes requested",
  published: "Published, awaiting approval", completed: "Completed",
  cancelled: "Cancelled", disputed: "Disputed",
};

const DONE: DealStatus[] = ["completed", "cancelled"];

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ needs_me?: string }>;
}) {
  const { user, role } = await requireUser("/deals");
  const sp = await searchParams;
  const filterSp = new URLSearchParams();
  if (sp.needs_me === "1") filterSp.set("needs_me", "1");
  const tokens = parseFilterTokens(filterSp, ["needs_me"]);
  const supabase = await createServerSupabase();

  const { data: deals, error } = await supabase
    .from("deals")
    .select("id, offering_title, price_cents, status, payment_mode, requested_at, brand_id, creator_id")
    .or(`brand_id.eq.${user.id},creator_id.eq.${user.id}`)
    .order("requested_at", { ascending: false });
  if (error) throw new Error("deals query failed: " + error.message);

  const mine = deals ?? [];
  const myRole = (d: { brand_id: string }) => (d.brand_id === user.id ? "brand" : "creator");
  const needsMe = mine.filter(
    (d) => !DONE.includes(d.status as DealStatus) && d.status !== "disputed" &&
      actionsFor(d.status as DealStatus, myRole(d), d.payment_mode as PaymentMode)
        .some((a) => !a.confirm)
  );
  const filterNeedsMe = tokens.some((t) => t.key === "needs_me" && t.value === "1");
  const filteredMine = filterNeedsMe ? needsMe : mine;
  const inFlight = filteredMine.filter(
    (d) => !DONE.includes(d.status as DealStatus) && !needsMe.includes(d)
  );
  const done = filteredMine.filter((d) => DONE.includes(d.status as DealStatus));
  const displayNeedsMe = filterNeedsMe ? filteredMine : needsMe;

  const section = (title: string, rows: typeof mine, accent?: boolean) => (
    <section className="mb-10">
      <h2 className="flex items-center gap-2.5 text-lg font-bold">
        {accent && rows.length > 0 && (
          <span aria-hidden className="size-2 rounded-full bg-amber" />
        )}
        {title}
        <span className="text-sm font-medium text-muted-foreground tabular-nums">
          ({rows.length})
        </span>
      </h2>
      {rows.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nothing here.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((d) => (
            <li key={d.id}>
              <Link
                href={`/deals/${d.id}`}
                className="deal-row flex items-center justify-between gap-4 rounded-2xl bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <span className="min-w-0 truncate">
                  <span className="font-semibold">{d.offering_title}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {myRole(d) === "brand" ? "buying" : "selling"}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-4">
                  <Badge variant="secondary">{STATUS_LABELS[d.status] ?? d.status}</Badge>
                  <span className="font-extrabold tabular-nums text-primary">
                    ${(d.price_cents / 100).toFixed(2)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <AuthenticatedShell userId={user.id} role={role}>
        <h1 className="text-2xl font-semibold tracking-tight">Deals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bookings and campaigns you accepted live here. Open campaigns are under Campaigns.
        </p>
        <FilterTokenBar
          tokens={tokens}
          basePath="/deals"
          allowedKeys={[{ key: "needs_me", label: "Needs me", options: [{ value: "1", label: "Yes" }] }]}
        />
        {mine.length === 0 ? (
          <div className="mt-8 rounded-[var(--radius-tile)] border border-[var(--border)] p-6 text-center">
            <p className="text-sm text-muted-foreground">No deals yet.</p>
            <Button asChild size="sm" className="mt-4">
              <Link href={role === "brand" ? "/campaigns" : "/campaigns"}>
                {role === "brand" ? "Start a campaign" : "See open campaigns"}
              </Link>
            </Button>
          </div>
        ) : filteredMine.length === 0 && tokens.length > 0 ? (
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">No results match your filters.</p>
            <Link href="/deals" className="mt-2 inline-block text-sm font-medium underline">
              Reset filters
            </Link>
          </div>
        ) : (
        <div className="mt-8">
          {section("Action needed", displayNeedsMe, true)}
          {section("In progress", inFlight)}
          {section("Done", done)}
        </div>
        )}
    </AuthenticatedShell>
  );
}
