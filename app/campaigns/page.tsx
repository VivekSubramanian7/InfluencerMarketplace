import Link from "next/link";
import { requireUser } from "@/lib/auth/require";
import { touchCursor } from "@/lib/feature-cursors";
import { createServerSupabase } from "@/lib/supabase/server";
import { AuthenticatedShell } from "@/components/authenticated-shell";
import { TemplatePicker } from "@/components/campaigns/template-picker";
import { FilterTokenBar } from "@/components/filters/filter-token-bar";
import { parseFilterTokens, type FilterToken } from "@/lib/filters/tokens";
import { Badge } from "@/components/ui/badge";

const TYPE_LABELS: Record<string, string> = {
  dedicated_video: "Dedicated video",
  integration: "Integration (60-90s)",
  short_form_post: "Short-form post",
  ugc_video: "UGC video (no posting)",
};

const APPLICATION_LABELS: Record<string, string> = {
  pending: "Pending review",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

function budgetRange(minCents: number, maxCents: number) {
  const fmt = (c: number) => "$" + Math.round(c / 100).toLocaleString("en-US");
  return minCents === maxCents ? fmt(minCents) : `${fmt(minCents)}–${fmt(maxCents)}`;
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    saved?: string;
    clone?: string;
    prefill_type?: string;
    prefill_niche?: string;
    status?: string;
    offering_type?: string;
  }>;
}) {
  const { user, role } = await requireUser("/campaigns");
  await touchCursor("campaigns");
  const sp = await searchParams;
  const { error, saved } = sp;
  const filterSp = new URLSearchParams();
  if (sp.status) filterSp.set("status", sp.status);
  if (sp.offering_type) filterSp.set("offering_type", sp.offering_type);
  const tokens = parseFilterTokens(filterSp, ["status", "offering_type"]);
  const supabase = await createServerSupabase();

  return (
    <AuthenticatedShell userId={user.id} role={role}>
        <h1 className="text-2xl font-semibold tracking-tight">
          {role === "brand" ? "Your campaigns" : "Open campaigns"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {role === "brand"
            ? "Post a brief and let creators come to you with a pitch and a price."
            : "Brands post briefs here. Pitch your take and name your price."}
        </p>
        {role === "brand" && (
          <FilterTokenBar
            tokens={tokens}
            basePath="/campaigns"
            allowedKeys={[
              { key: "status", label: "Status", options: [
                { value: "open", label: "Open" },
                { value: "closed", label: "Closed" },
              ]},
              { key: "offering_type", label: "Format", options: [
                { value: "short_form_post", label: "Short-form post" },
                { value: "dedicated_video", label: "Dedicated video" },
                { value: "integration", label: "Integration" },
                { value: "ugc_video", label: "UGC video" },
              ]},
            ]}
          />
        )}
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
        {role === "brand" ? (
          <BrandCampaigns userId={user.id} supabase={supabase} tokens={tokens} />
        ) : (
          <CreatorCampaigns userId={user.id} supabase={supabase} />
        )}
    </AuthenticatedShell>
  );
}

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

async function BrandCampaigns({
  userId,
  supabase,
  tokens,
}: {
  userId: string;
  supabase: Supabase;
  tokens: FilterToken[];
}) {
  const [{ data: campaigns, error }, { count: liveCreators }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, title, description, offering_type, budget_min_cents, budget_max_cents, apply_by, status, created_at")
      .eq("brand_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("creator_profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "live"),
  ]);
  if (error) throw new Error("campaigns query failed: " + error.message);

  const filtered = (campaigns ?? []).filter((c) => {
    for (const t of tokens) {
      if (t.key === "status" && c.status !== t.value) return false;
      if (t.key === "offering_type" && c.offering_type !== t.value) return false;
    }
    return true;
  });

  const ids = filtered.map((c) => c.id);
  type Stats = { pending: number; accepted: number; declined: number };
  const statsByCampaign = new Map<string, Stats>();
  if (ids.length > 0) {
    const { data: apps, error: aErr } = await supabase
      .from("campaign_applications")
      .select("campaign_id, status")
      .in("campaign_id", ids);
    if (aErr) throw new Error("applications query failed: " + aErr.message);
    for (const a of apps ?? []) {
      if (a.status === "withdrawn") continue;
      const s = statsByCampaign.get(a.campaign_id) ?? { pending: 0, accepted: 0, declined: 0 };
      if (a.status === "pending") s.pending++;
      else if (a.status === "accepted") s.accepted++;
      else if (a.status === "declined") s.declined++;
      statsByCampaign.set(a.campaign_id, s);
    }
  }

  return (
    <>
      <TemplatePicker
        campaigns={(campaigns ?? []).map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description ?? "",
          offering_type: c.offering_type,
          budget_min_cents: c.budget_min_cents,
          budget_max_cents: c.budget_max_cents,
        }))}
        liveCreatorCount={liveCreators ?? 0}
      />
      {filtered.length === 0 && tokens.length > 0 ? (
        <div className="mt-6 text-center">
          <p className="text-sm text-[var(--muted)]">No campaigns match your filters.</p>
          <Link href="/campaigns" className="mt-2 inline-block text-sm font-medium underline underline-offset-2">
            Reset filters
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-[var(--radius-tile)] border border-[var(--border)] p-8 text-center">
          <p className="font-medium text-[var(--ink)]">No campaigns yet</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Post your first brief and let creators pitch.</p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {filtered.map((c) => {
            const stats = statsByCampaign.get(c.id);
            return (
              <li key={c.id}>
                <Link
                  href={`/campaigns/${c.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border p-5 transition-colors hover:border-primary/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{c.title}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {TYPE_LABELS[c.offering_type] ?? c.offering_type}
                      {c.apply_by ? ` · apply by ${c.apply_by}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-4">
                    {stats && (stats.pending > 0 || stats.accepted > 0 || stats.declined > 0) && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {[
                          stats.pending > 0 && `${stats.pending} pending`,
                          stats.accepted > 0 && `${stats.accepted} accepted`,
                          stats.declined > 0 && `${stats.declined} declined`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                    <Badge variant="secondary">{c.status}</Badge>
                    <span className="font-semibold tabular-nums text-primary">
                      {budgetRange(c.budget_min_cents, c.budget_max_cents)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

async function CreatorCampaigns({ userId, supabase }: { userId: string; supabase: Supabase }) {
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: campaigns, error }, { data: myApps, error: aErr }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, brand_id, title, description, offering_type, budget_min_cents, budget_max_cents, apply_by, created_at")
      .eq("status", "open")
      .or(`apply_by.is.null,apply_by.gte.${today}`)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("campaign_applications")
      .select("campaign_id, status")
      .eq("creator_id", userId),
  ]);
  if (error) throw new Error("campaigns query failed: " + error.message);
  if (aErr) throw new Error("applications query failed: " + aErr.message);

  const brandIds = [...new Set((campaigns ?? []).map((c) => c.brand_id))];
  const nameById = new Map<string, string | null>();
  const companyById = new Map<string, string | null>();
  if (brandIds.length > 0) {
    const [{ data: profiles }, { data: brands }] = await Promise.all([
      supabase.from("profiles").select("id, display_name").in("id", brandIds),
      supabase.from("brand_profiles").select("user_id, company").in("user_id", brandIds),
    ]);
    for (const p of profiles ?? []) nameById.set(p.id, p.display_name);
    for (const b of brands ?? []) companyById.set(b.user_id, b.company);
  }
  const myStatusByCampaign = new Map((myApps ?? []).map((a) => [a.campaign_id, a.status]));

  return (
    <ul className="mt-6 flex flex-col gap-3">
      {(campaigns ?? []).map((c) => {
        const brandName = companyById.get(c.brand_id) || nameById.get(c.brand_id) || "A brand";
        const mine = myStatusByCampaign.get(c.id);
        return (
          <li key={c.id}>
            <Link
              href={`/campaigns/${c.id}`}
              className="block rounded-xl border p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-bold">{c.title}</span>
                <span className="shrink-0 font-semibold tabular-nums text-primary">
                  {budgetRange(c.budget_min_cents, c.budget_max_cents)}
                </span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                {brandName} · {TYPE_LABELS[c.offering_type] ?? c.offering_type}
                {c.apply_by ? ` · apply by ${c.apply_by}` : ""}
                {mine && <Badge variant="secondary">{APPLICATION_LABELS[mine] ?? mine}</Badge>}
              </p>
              <p className="mt-2 line-clamp-2 text-sm">{c.description}</p>
            </Link>
          </li>
        );
      })}
      {(campaigns ?? []).length === 0 ? (
        <li className="rounded-[var(--radius-tile)] border border-[var(--border)] p-8 text-center">
          <p className="font-medium text-[var(--ink)]">No open campaigns right now</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Brands post briefs here — check back soon.</p>
        </li>
      ) : null}
    </ul>
  );
}
