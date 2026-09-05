import Link from "next/link";
import { requireUser } from "@/lib/auth/require";
import { touchCursor } from "@/lib/feature-cursors";
import { createServerSupabase } from "@/lib/supabase/server";
import { actionsFor, primaryActionLabel } from "@/lib/deals/ui-actions";
import type { DealStatus, PaymentMode } from "@/lib/deals/machine";
import { AuthenticatedShell } from "@/components/authenticated-shell";
import { FilterTokenBar } from "@/components/filters/filter-token-bar";
import { parseFilterTokens } from "@/lib/filters/tokens";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS } from "@/lib/deals/constants";

const DONE: DealStatus[] = ["completed", "cancelled"];

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ needs_me?: string }>;
}) {
  const { user, role } = await requireUser("/deals");
  await touchCursor("deals");
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
    <section className="mb-8">
      <h2 className="flex items-center gap-2.5 text-lg font-semibold">
        {accent && rows.length > 0 && (
          <span aria-hidden className="size-2 rounded-full bg-[var(--amber)]" />
        )}
        {title}
        <span className="ml-1 text-sm font-medium text-[var(--muted)] tabular-nums">
          {rows.length}
        </span>
      </h2>
      {rows.length === 0 ? (
        <p className="mt-3 rounded-[var(--radius-tile)] border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
          Nothing matching this section right now.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--divider)]">
          {rows.map((d) => {
            const r = myRole(d);
            const action = primaryActionLabel(d.status as DealStatus, r, d.payment_mode as PaymentMode);
            return (
              <li key={d.id}>
                <Link
                  href={`/deals/${d.id}`}
                  className="flex items-center gap-4 px-2 py-3 transition-colors hover:bg-[var(--row-hover)]"
                >
                  <span
                    aria-hidden
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--ground)] text-xs font-semibold text-[var(--ink)]"
                  >
                    {(d.offering_title ?? "?").charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{d.offering_title}</span>
                    <span className="block truncate text-xs text-[var(--muted)]">
                      {r === "brand" ? "Buying" : "Selling"}
                      {d.requested_at ? ` · ${timeAgo(d.requested_at)}` : ""}
                    </span>
                  </span>
                  <Badge variant="secondary" className="shrink-0">
                    {STATUS_LABELS[d.status as DealStatus] ?? d.status}
                  </Badge>
                  <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">
                    ${(d.price_cents / 100).toFixed(0)}
                  </span>
                  {action ? (
                    <span className="shrink-0 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)]">
                      {action} →
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-[var(--muted)]">→</span>
                  )}
                </Link>
              </li>
            );
          })}
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
            <p className="font-medium text-[var(--ink)]">No deals yet</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {role === "brand"
                ? "Start a campaign and deals will appear here as creators accept."
                : "Apply to open campaigns — accepted deals show up here."}
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/campaigns">
                {role === "brand" ? "Start a campaign" : "See open campaigns"}
              </Link>
            </Button>
          </div>
        ) : filteredMine.length === 0 && tokens.length > 0 ? (
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">No results match your filters.</p>
            <Link href="/deals" className="mt-2 inline-block text-sm font-medium underline underline-offset-2">
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
