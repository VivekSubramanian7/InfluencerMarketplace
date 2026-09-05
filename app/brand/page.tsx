import Link from "next/link";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { actionsFor } from "@/lib/deals/ui-actions";
import type { DealStatus, PaymentMode } from "@/lib/deals/machine";
import { performDealAction } from "@/app/deals/[id]/actions";
import { unblockCreator } from "./actions";
import { AuthenticatedShell } from "@/components/authenticated-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const DEAL_LABELS: Record<string, string> = {
  requested: "Awaiting creator",
  accepted: "In production",
  submitted: "Preview submitted", revision_requested: "Changes requested",
  published: "Published, awaiting approval", completed: "Completed",
  cancelled: "Cancelled", disputed: "Disputed",
};
const INVITE_LABELS: Record<string, string> = {
  invited: "Invite pending", accepted: "In conversation", declined: "Declined",
};
const DONE = ["completed", "cancelled"];

export default async function BrandOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { user, role } = await requireRole("brand", "/brand");
  const { error } = await searchParams;
  const supabase = await createServerSupabase();

  const [profileRes, convRes, dealsRes, blockRes, productCountRes, openCampaignRes, campaignCountRes, liveCreatorsRes] =
    await Promise.all([
    supabase.from("brand_profiles").select("company").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("conversations")
      .select("id, creator_id, status, created_at")
      .eq("brand_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("deals")
      .select("id, creator_id, offering_title, price_cents, status, requested_at, payment_mode")
      .eq("brand_id", user.id)
      .order("requested_at", { ascending: false }),
    supabase.from("brand_blocklist").select("creator_id, created_at").eq("brand_id", user.id),
    supabase
      .from("brand_products")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", user.id),
    supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", user.id)
      .eq("status", "open"),
    supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", user.id),
    supabase
      .from("creator_profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "live"),
  ]);

  const hasProfile = !!profileRes.data;

  const conversations = convRes.data ?? [];
  const deals = dealsRes.data ?? [];
  const blocked = blockRes.data ?? [];
  const productCount = productCountRes.count ?? 0;
  const openCampaigns = openCampaignRes.count ?? 0;
  const campaignCount = campaignCountRes.count ?? 0;
  const liveCreators = liveCreatorsRes.count ?? 0;

  const creatorIds = [
    ...new Set([
      ...conversations.map((c) => c.creator_id),
      ...deals.map((d) => d.creator_id),
      ...blocked.map((b) => b.creator_id),
    ]),
  ];
  const nameById = new Map<string, string | null>();
  const handleById = new Map<string, string>();
  if (creatorIds.length > 0) {
    const [{ data: profiles }, { data: creators }] = await Promise.all([
      supabase.from("profiles").select("id, display_name").in("id", creatorIds),
      supabase.from("creator_profiles").select("user_id, handle").in("user_id", creatorIds),
    ]);
    for (const p of profiles ?? []) nameById.set(p.id, p.display_name);
    for (const c of creators ?? []) handleById.set(c.user_id, c.handle);
  }
  const creatorLabel = (id: string) =>
    nameById.get(id) || (handleById.get(id) ? `@${handleById.get(id)}` : "Creator");

  const inProgress = deals.filter((d) => !DONE.includes(d.status));
  const completed = deals.filter((d) => d.status === "completed");

  const stat = (label: string, value: number) => (
    <div className="stat-card rounded-[var(--radius-tile)] border border-[var(--border)] p-5">
      <p className="text-3xl font-extrabold tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );

  const checklist = [
    {
      label: "Complete your profile",
      done: true,
      href: "/brand/settings#profile",
    },
    {
      label: "Add your first product",
      done: productCount > 0,
      href: "/brand/settings#products",
    },
    {
      label: "Reach out to a creator",
      done: conversations.length > 0,
      href: "/discover",
    },
    {
      label: "Post a campaign",
      done: campaignCount > 0,
      href: "/campaigns",
    },
    {
      label: "Close your first deal",
      done: completed.length > 0,
      href: "/deals",
    },
  ];
  const allDone = checklist.every((c) => c.done);
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <AuthenticatedShell userId={user.id} role={role}>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            {profileRes.data?.company || "Your brand"}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/brand/settings">Settings</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/brand/settings#invites">Invite a creator</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/campaigns">
                Campaigns{openCampaigns > 0 ? ` (${openCampaigns})` : ""}
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/discover">Find creators</Link>
            </Button>
          </div>
        </div>

        {!hasProfile && (
          <div className="mt-6 rounded-[var(--radius-tile)] border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="text-lg font-semibold text-[var(--ink)]">Finish setting up your brand</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Add your company name and the formats you book. Then you can post a campaign.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/brand/onboarding">Continue setup</Link>
            </Button>
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--radius-tile)] border border-[var(--border)] p-4">
            <p className="text-xl font-semibold tabular-nums">{liveCreators}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Live creators
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {!allDone && (
          <section className="mt-6 rounded-[var(--radius-tile)] border border-[var(--border)] p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-bold">Getting started</h2>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {doneCount} of {checklist.length}
              </span>
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {checklist.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-secondary"
                  >
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-full border text-xs ${
                        item.done
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {item.done && "✓"}
                    </span>
                    <span className={item.done ? "text-muted-foreground line-through" : "font-medium"}>
                      {item.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="card-grid mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stat("Contacted", conversations.length)}
          {stat("In progress", inProgress.length)}
          {stat("Completed", completed.length)}
          {stat("Blocked", blocked.length)}
        </div>

        <section className="mt-10">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-bold">Contacted creators</h2>
            <Link href="/inbox" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Open inbox →
            </Link>
          </div>
          {conversations.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No reachouts yet. Select creators in{" "}
              <Link href="/discover" className="font-medium underline underline-offset-2">Discover</Link>{" "}
              to invite them.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {conversations.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/inbox/${c.id}`}
                    className="flex items-center justify-between gap-4 rounded-[var(--radius-tile)] border border-[var(--border)] p-4 transition-colors hover:bg-[var(--row-hover)]"
                  >
                    <span className="min-w-0 truncate font-medium">{creatorLabel(c.creator_id)}</span>
                    <Badge variant="secondary">{INVITE_LABELS[c.status] ?? c.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-bold">Deals in progress</h2>
            <Link href="/deals" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              All deals →
            </Link>
          </div>
          {inProgress.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nothing in flight.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {inProgress.map((d) => {
                const dealActions = actionsFor(
                  d.status as DealStatus,
                  "brand",
                  (d as { payment_mode?: PaymentMode }).payment_mode ?? "off_platform"
                );
                const quickAction = dealActions.find(
                  (a) => !a.confirm && !a.needsUrl && ["approve"].includes(a.action)
                );

                return (
                  <li key={d.id} className="flex items-center gap-2">
                    <Link
                      href={`/deals/${d.id}`}
                      className="deal-row flex flex-1 items-center justify-between gap-4 rounded-[var(--radius-tile)] border border-[var(--border)] p-4 transition-colors hover:bg-[var(--row-hover)]"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{creatorLabel(d.creator_id)}</span>
                        <span className="text-muted-foreground"> · {d.offering_title}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <Badge variant="secondary">{DEAL_LABELS[d.status] ?? d.status}</Badge>
                        <span className="font-extrabold tabular-nums text-primary">
                          ${(d.price_cents / 100).toFixed(2)}
                        </span>
                      </span>
                    </Link>
                    {quickAction && (
                      <form action={performDealAction}>
                        <input type="hidden" name="deal_id" value={d.id} />
                        <input type="hidden" name="action" value={quickAction.action} />
                        <Button type="submit" size="sm">
                          {quickAction.label}
                        </Button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold">Completed</h2>
          {completed.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No completed deals yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {completed.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/deals/${d.id}`}
                    className="flex items-center justify-between gap-4 rounded-[var(--radius-tile)] border border-[var(--border)] p-4 transition-colors hover:bg-[var(--row-hover)]"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{creatorLabel(d.creator_id)}</span>
                      <span className="text-muted-foreground"> · {d.offering_title}</span>
                    </span>
                    <span className="font-extrabold tabular-nums text-primary">
                      ${(d.price_cents / 100).toFixed(2)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold">Blocked creators</h2>
          {blocked.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nobody blocked. Blocked creators disappear from your Discover and reachout.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {blocked.map((b) => (
                <li
                  key={b.creator_id}
                  className="flex items-center justify-between gap-4 rounded-xl border p-4"
                >
                  <span className="font-medium">{creatorLabel(b.creator_id)}</span>
                  <form action={unblockCreator}>
                    <input type="hidden" name="creator_id" value={b.creator_id} />
                    <Button type="submit" variant="outline" size="sm">Unblock</Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
    </AuthenticatedShell>
  );
}
