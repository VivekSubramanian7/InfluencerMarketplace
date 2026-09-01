import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { applyToCampaign, withdrawApplication, decideApplication } from "./actions";
import { setCampaignStatus } from "../actions";
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

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { user, role } = await requireUser(`/campaigns/${id}`);
  const { error, saved } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, brand_id, title, description, offering_type, budget_min_cents, budget_max_cents, apply_by, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!campaign) notFound();

  const isOwner = campaign.brand_id === user.id;
  const windowClosed =
    campaign.apply_by !== null && campaign.apply_by < new Date().toISOString().slice(0, 10);

  const { data: brandProfile } = await supabase
    .from("brand_profiles").select("company, website").eq("user_id", campaign.brand_id).maybeSingle();
  const { data: brandName } = await supabase
    .from("profiles").select("display_name").eq("id", campaign.brand_id).maybeSingle();

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <Link href="/campaigns" className="text-sm text-muted-foreground hover:text-foreground">
          ← Campaigns
        </Link>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight">{campaign.title}</h1>
          <span className="text-2xl font-extrabold tabular-nums text-primary">
            {budgetRange(campaign.budget_min_cents, campaign.budget_max_cents)}
          </span>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          {brandProfile?.company || brandName?.display_name || "A brand"} ·{" "}
          {TYPE_LABELS[campaign.offering_type] ?? campaign.offering_type}
          {campaign.apply_by ? ` · apply by ${campaign.apply_by}` : ""}
          <Badge variant="secondary">{campaign.status === "open" && !windowClosed ? "open" : "closed"}</Badge>
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

        <p className="mt-6 max-w-prose whitespace-pre-wrap text-[15px] leading-relaxed">
          {campaign.description}
        </p>

        {isOwner ? (
          <OwnerPanel campaignId={campaign.id} status={campaign.status} supabase={supabase} />
        ) : role === "creator" ? (
          <CreatorPanel
            campaignId={campaign.id}
            open={campaign.status === "open" && !windowClosed}
            userId={user.id}
            supabase={supabase}
          />
        ) : null}
      </main>
    </>
  );
}

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

async function OwnerPanel({
  campaignId,
  status,
  supabase,
}: {
  campaignId: string;
  status: string;
  supabase: Supabase;
}) {
  const { data: apps, error } = await supabase
    .from("campaign_applications")
    .select("id, creator_id, pitch, proposed_price_cents, status, deal_id, created_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("applications query failed: " + error.message);

  const creatorIds = [...new Set((apps ?? []).map((a) => a.creator_id))];
  const handleById = new Map<string, string>();
  const nameById = new Map<string, string | null>();
  if (creatorIds.length > 0) {
    const [{ data: creators }, { data: profiles }] = await Promise.all([
      supabase.from("creator_profiles").select("user_id, handle").in("user_id", creatorIds),
      supabase.from("profiles").select("id, display_name").in("id", creatorIds),
    ]);
    for (const c of creators ?? []) handleById.set(c.user_id, c.handle);
    for (const p of profiles ?? []) nameById.set(p.id, p.display_name);
  }

  const visible = (apps ?? []).filter((a) => a.status !== "withdrawn");

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold">Applications</h2>
        <form action={setCampaignStatus}>
          <input type="hidden" name="id" value={campaignId} />
          <input type="hidden" name="status" value={status === "open" ? "closed" : "open"} />
          <Button type="submit" variant="outline" size="sm">
            {status === "open" ? "Close campaign" : "Reopen campaign"}
          </Button>
        </form>
      </div>
      <ul className="mt-4 flex flex-col gap-3">
        {visible.map((a) => {
          const handle = handleById.get(a.creator_id);
          return (
            <li key={a.id} className="rounded-xl border p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="font-bold">
                  {nameById.get(a.creator_id) || handle || "Creator"}
                  {handle && (
                    <Link
                      href={`/c/${handle}`}
                      className="ml-2 text-sm font-medium text-muted-foreground underline-offset-2 hover:underline"
                    >
                      @{handle}
                    </Link>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <Badge variant="secondary">{APPLICATION_LABELS[a.status] ?? a.status}</Badge>
                  <span className="font-extrabold tabular-nums text-primary">
                    ${(a.proposed_price_cents / 100).toFixed(2)}
                  </span>
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{a.pitch}</p>
              {a.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <form action={decideApplication}>
                    <input type="hidden" name="campaign_id" value={campaignId} />
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="decision" value="accepted" />
                    <Button type="submit" size="sm">Accept</Button>
                  </form>
                  <form action={decideApplication}>
                    <input type="hidden" name="campaign_id" value={campaignId} />
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="decision" value="declined" />
                    <Button type="submit" variant="outline" size="sm">Decline</Button>
                  </form>
                </div>
              )}
              {a.status === "accepted" && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {a.deal_id ? (
                    <>
                      Accepted at their proposed price —{" "}
                      <Link href={`/deals/${a.deal_id}`} className="font-medium underline underline-offset-2">
                        open the deal
                      </Link>
                      .
                    </>
                  ) : (
                    "Accepted."
                  )}
                </p>
              )}
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No applications yet.
          </li>
        )}
      </ul>
    </section>
  );
}

async function CreatorPanel({
  campaignId,
  open,
  userId,
  supabase,
}: {
  campaignId: string;
  open: boolean;
  userId: string;
  supabase: Supabase;
}) {
  const { data: mine } = await supabase
    .from("campaign_applications")
    .select("id, pitch, proposed_price_cents, status, deal_id")
    .eq("campaign_id", campaignId)
    .eq("creator_id", userId)
    .maybeSingle();

  if (mine) {
    return (
      <section className="mt-10 max-w-xl rounded-xl border p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold">Your application</h2>
          <span className="flex items-center gap-3">
            <Badge variant="secondary">{APPLICATION_LABELS[mine.status] ?? mine.status}</Badge>
            <span className="font-extrabold tabular-nums text-primary">
              ${(mine.proposed_price_cents / 100).toFixed(2)}
            </span>
          </span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm">{mine.pitch}</p>
        {mine.status === "accepted" && (
          <p className="mt-3 text-sm text-ok">
            {mine.deal_id ? (
              <>
                Accepted at your price —{" "}
                <Link href={`/deals/${mine.deal_id}`} className="font-medium underline underline-offset-2">
                  open the deal
                </Link>
                .
              </>
            ) : (
              "Accepted."
            )}
          </p>
        )}
        {mine.status === "pending" && (
          <form action={withdrawApplication} className="mt-3">
            <input type="hidden" name="campaign_id" value={campaignId} />
            <input type="hidden" name="id" value={mine.id} />
            <Button type="submit" variant="outline" size="sm" className="text-destructive border-destructive/40">
              Withdraw application
            </Button>
          </form>
        )}
      </section>
    );
  }

  if (!open) {
    return (
      <p className="mt-10 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        This campaign is no longer accepting applications.
      </p>
    );
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold">Apply to this campaign</h2>
      <form action={applyToCampaign} className="mt-3 flex max-w-xl flex-col gap-4">
        <input type="hidden" name="campaign_id" value={campaignId} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pitch">Your pitch</Label>
          <Textarea
            id="pitch"
            name="pitch"
            rows={5}
            required
            placeholder="Why you're the right creator for this — your angle, your audience, relevant work."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="proposed_price">Your price (USD)</Label>
          <Input id="proposed_price" name="proposed_price" inputMode="decimal" required />
        </div>
        <Button type="submit" className="mt-2 self-start">
          Submit application
        </Button>
      </form>
    </section>
  );
}
