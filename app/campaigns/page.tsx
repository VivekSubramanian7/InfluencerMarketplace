import Link from "next/link";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { createCampaign } from "./actions";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  }>;
}) {
  const { user, role } = await requireUser("/campaigns");
  const { error, saved, clone, prefill_type, prefill_niche } = await searchParams;
  const supabase = await createServerSupabase();

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {role === "brand" ? "Your campaigns" : "Open campaigns"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {role === "brand"
            ? "Post a brief and let creators come to you with a pitch and a price."
            : "Brands post briefs here. Pitch your take and name your price."}
        </p>
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
          <BrandCampaigns
            userId={user.id}
            supabase={supabase}
            cloneId={clone}
            prefillType={prefill_type}
            prefillNiche={prefill_niche}
          />
        ) : (
          <CreatorCampaigns userId={user.id} supabase={supabase} />
        )}
      </main>
    </>
  );
}

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

async function BrandCampaigns({
  userId,
  supabase,
  cloneId,
  prefillType,
  prefillNiche,
}: {
  userId: string;
  supabase: Supabase;
  cloneId?: string;
  prefillType?: string;
  prefillNiche?: string;
}) {
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id, title, offering_type, budget_min_cents, budget_max_cents, apply_by, status, created_at")
    .eq("brand_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("campaigns query failed: " + error.message);

  const ids = (campaigns ?? []).map((c) => c.id);
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

  let cloneData: {
    title: string;
    description: string;
    offering_type: string;
    budget_min_cents: number;
    budget_max_cents: number;
  } | null = null;
  if (cloneId) {
    const { data } = await supabase
      .from("campaigns")
      .select("title, description, offering_type, budget_min_cents, budget_max_cents")
      .eq("id", cloneId)
      .eq("brand_id", userId)
      .maybeSingle();
    cloneData = data;
  }

  return (
    <>
      <ul className="mt-6 mb-10 flex flex-col gap-2">
        {(campaigns ?? []).map((c) => {
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
                  <span className="font-extrabold tabular-nums text-primary">
                    {budgetRange(c.budget_min_cents, c.budget_max_cents)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
        {(campaigns ?? []).length === 0 && (
          <li className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No campaigns yet. Start your first below.
          </li>
        )}
      </ul>

      <h2 className="text-lg font-bold">{cloneData ? "Clone campaign" : "Start a campaign"}</h2>
      <form action={createCampaign} className="mt-3 flex max-w-xl flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            required
            defaultValue={cloneData?.title ?? ""}
            placeholder="Spring launch, honest review videos"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">What you&apos;re looking for</Label>
          <Textarea
            id="description"
            name="description"
            rows={5}
            required
            defaultValue={
              cloneData?.description ??
              (prefillNiche ? `Looking for ${prefillNiche} creators to…` : "")
            }
            placeholder="The product, the audience you want to reach, and what a great video looks like to you."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="type">Content type</Label>
          <select
            id="type"
            name="type"
            className="h-10 rounded-lg border bg-background px-3 text-sm"
            defaultValue={cloneData?.offering_type ?? prefillType ?? "dedicated_video"}
          >
            {Object.entries(TYPE_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="budget_min">Budget from (USD)</Label>
            <Input
              id="budget_min"
              name="budget_min"
              inputMode="decimal"
              required
              defaultValue={cloneData ? (cloneData.budget_min_cents / 100).toFixed(2) : ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="budget_max">Budget to (USD)</Label>
            <Input
              id="budget_max"
              name="budget_max"
              inputMode="decimal"
              required
              defaultValue={cloneData ? (cloneData.budget_max_cents / 100).toFixed(2) : ""}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="apply_by">Applications close (optional)</Label>
          <Input id="apply_by" name="apply_by" type="date" />
        </div>
        <Button type="submit" className="mt-2">
          {cloneData ? "Create from template" : "Start campaign"}
        </Button>
      </form>
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
                <span className="shrink-0 font-extrabold tabular-nums text-primary">
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
      {(campaigns ?? []).length === 0 && (
        <li className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No open campaigns right now. Check back soon.
        </li>
      )}
    </ul>
  );
}
