import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { applyToCampaign, withdrawApplication } from "./actions";
import { creatorCanApply } from "@/lib/campaigns/offering-match";
import { setCampaignStatus } from "../actions";
import { AuthenticatedShell } from "@/components/authenticated-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EditCampaignForm } from "./edit-campaign-form";
import { BulkProposals } from "./bulk-proposals";

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

function pitchPlaceholder(offeringType: string): string {
  switch (offeringType) {
    case "dedicated_video":
      return "What angle would you take? Mention your audience size and why they'd care about this product.";
    case "integration":
      return "How would you weave this into your content? What video would this fit naturally into?";
    case "short_form_post":
      return "What hook would you use? What's your typical view count on shorts?";
    case "ugc_video":
      return "Describe your production style and turnaround. Include any relevant past UGC work.";
    default:
      return "Why you're the right creator for this: your angle, your audience, relevant work.";
  }
}

function budgetRange(minCents: number, maxCents: number) {
  const fmt = (c: number) => "$" + Math.round(c / 100).toLocaleString("en-US");
  return minCents === maxCents ? fmt(minCents) : `${fmt(minCents)}–${fmt(maxCents)}`;
}

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; invited?: string }>;
}) {
  const { id } = await params;
  const { user, role } = await requireUser(`/campaigns/${id}`);
  const { error, saved, invited } = await searchParams;
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
    <AuthenticatedShell userId={user.id} role={role}>
        <Link href="/campaigns" className="text-sm text-muted-foreground hover:text-foreground">
          ← Campaigns
        </Link>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{campaign.title}</h1>
          <span className="text-2xl font-extrabold tabular-nums text-primary">
            {budgetRange(campaign.budget_min_cents, campaign.budget_max_cents)}
          </span>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          {brandProfile?.company || brandName?.display_name || "A brand"} ·{" "}
          {TYPE_LABELS[campaign.offering_type] ?? campaign.offering_type}
          {campaign.apply_by ? ` · Apply by ${campaign.apply_by}` : ""}
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
        {invited && (
          <p className="mt-4 rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
            Invitation sent! Check your inbox.
          </p>
        )}

        <p className="mt-6 max-w-prose whitespace-pre-wrap text-[15px] leading-relaxed">
          {campaign.description}
        </p>

        {isOwner && (
          <Link
            href={`/campaigns?clone=${campaign.id}`}
            className="mt-4 inline-block text-sm font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Use as template →
          </Link>
        )}

        {isOwner ? (
          <OwnerPanel
            campaignId={campaign.id}
            status={campaign.status}
            title={campaign.title}
            description={campaign.description}
            budgetMinCents={campaign.budget_min_cents}
            budgetMaxCents={campaign.budget_max_cents}
            applyBy={campaign.apply_by}
            supabase={supabase}
          />
        ) : role === "creator" ? (
          <CreatorPanel
            campaignId={campaign.id}
            open={campaign.status === "open" && !windowClosed}
            userId={user.id}
            budgetMinCents={campaign.budget_min_cents}
            budgetMaxCents={campaign.budget_max_cents}
            offeringType={campaign.offering_type}
            supabase={supabase}
          />
        ) : null}
    </AuthenticatedShell>
  );
}

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

async function OwnerPanel({
  campaignId,
  status,
  title,
  description,
  budgetMinCents,
  budgetMaxCents,
  applyBy,
  supabase,
}: {
  campaignId: string;
  status: string;
  title: string;
  description: string;
  budgetMinCents: number;
  budgetMaxCents: number;
  applyBy: string | null;
  supabase: Supabase;
}) {
  const { data: apps, error } = await supabase
    .from("campaign_applications")
    .select("id, creator_id, pitch, proposed_price_cents, status, deal_id, decline_reason, created_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("applications query failed: " + error.message);

  const creatorIds = [...new Set((apps ?? []).map((a) => a.creator_id))];
  const handleById = new Map<string, string>();
  const nameById = new Map<string, string | null>();
  const ratingByCreator = new Map<string, { avg: number; count: number }>();
  const verifiedIds = new Set<string>();
  if (creatorIds.length > 0) {
    const [{ data: creators }, { data: profiles }, { data: reviews }, { data: stats }] = await Promise.all([
      supabase.from("creator_profiles").select("user_id, handle").in("user_id", creatorIds),
      supabase.from("profiles").select("id, display_name").in("id", creatorIds),
      supabase.from("public_creator_reviews").select("creator_id, rating").in("creator_id", creatorIds),
      supabase.from("public_creator_stats").select("creator_id, verification_status").in("creator_id", creatorIds),
    ]);
    for (const c of creators ?? []) handleById.set(c.user_id, c.handle);
    for (const p of profiles ?? []) nameById.set(p.id, p.display_name);
    const sums = new Map<string, { sum: number; count: number }>();
    for (const r of reviews ?? []) {
      const cur = sums.get(r.creator_id as string);
      if (!cur) sums.set(r.creator_id as string, { sum: r.rating as number, count: 1 });
      else { cur.sum += r.rating as number; cur.count += 1; }
    }
    for (const [cid, s] of sums) {
      ratingByCreator.set(cid, { avg: Math.round((s.sum / s.count) * 10) / 10, count: s.count });
    }
    for (const s of stats ?? []) {
      if (s.verification_status === "verified") verifiedIds.add(s.creator_id as string);
    }
  }

  const convByCreator = new Map<string, string>();
  if (creatorIds.length > 0) {
    const { data: authUser } = await supabase.auth.getUser();
    const brandId = authUser.user?.id;
    if (brandId) {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, creator_id")
        .eq("brand_id", brandId)
        .in("creator_id", creatorIds);
      for (const c of convs ?? []) convByCreator.set(c.creator_id, c.id);
    }
  }

  const visible = (apps ?? []).filter((a) => a.status !== "withdrawn");

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold">Proposals</h2>
        <form action={setCampaignStatus}>
          <input type="hidden" name="id" value={campaignId} />
          <input type="hidden" name="status" value={status === "open" ? "closed" : "open"} />
          <Button type="submit" variant="outline" size="sm">
            {status === "open" ? "Close campaign" : "Reopen campaign"}
          </Button>
        </form>
      </div>
      {status === "open" && (
        <EditCampaignForm
          campaign={{
            id: campaignId,
            title,
            description,
            budget_min_cents: budgetMinCents,
            budget_max_cents: budgetMaxCents,
            apply_by: applyBy,
          }}
        />
      )}
      <div className="mt-4">
        <BulkProposals
          campaignId={campaignId}
          applications={visible.map((a) => ({
            id: a.id,
            creator_id: a.creator_id,
            pitch: a.pitch,
            proposed_price_cents: a.proposed_price_cents,
            status: a.status,
            deal_id: a.deal_id,
            decline_reason: a.decline_reason,
          }))}
          nameById={Object.fromEntries(nameById)}
          handleById={Object.fromEntries(handleById)}
          convByCreator={Object.fromEntries(convByCreator)}
          ratingByCreator={Object.fromEntries(ratingByCreator)}
          verifiedById={Object.fromEntries([...verifiedIds].map((id) => [id, true]))}
        />
      </div>
    </section>
  );
}

async function CreatorPanel({
  campaignId,
  open,
  userId,
  budgetMinCents,
  budgetMaxCents,
  offeringType,
  supabase,
}: {
  campaignId: string;
  open: boolean;
  userId: string;
  budgetMinCents: number;
  budgetMaxCents: number;
  offeringType: string;
  supabase: Supabase;
}) {
  const { data: mine } = await supabase
    .from("campaign_applications")
    .select("id, pitch, proposed_price_cents, status, deal_id, decline_reason")
    .eq("campaign_id", campaignId)
    .eq("creator_id", userId)
    .maybeSingle();

  const [{ data: stats }, { data: reviews }, { count: completedDealCount }, { data: offerings }, { data: creatorProfile }] = await Promise.all([
    supabase.from("public_creator_stats").select("platform, follower_count").eq("creator_id", userId),
    supabase.from("public_creator_reviews").select("rating").eq("creator_id", userId),
    supabase.from("deals").select("id", { count: "exact", head: true }).eq("creator_id", userId).eq("status", "completed"),
    supabase.from("offerings").select("type").eq("creator_id", userId).eq("active", true),
    supabase.from("creator_profiles").select("handle").eq("user_id", userId).maybeSingle(),
  ]);
  const totalFollowers = (stats ?? []).reduce((sum, s) => sum + (s.follower_count ?? 0), 0);
  const avgRating = (reviews ?? []).length > 0
    ? Math.round(((reviews ?? []).reduce((s, r) => s + (r.rating as number), 0) / (reviews ?? []).length) * 10) / 10
    : null;

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
        {mine.status === "declined" && mine.decline_reason && (
          <p className="mt-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium">Brand feedback:</span> {mine.decline_reason}
          </p>
        )}
        {mine.status === "accepted" && (
          <p className="mt-3 text-sm text-ok">
            {mine.deal_id ? (
              <>
                Accepted at your price!{" "}
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

  const activeTypes = (offerings ?? []).map((o) => o.type);
  const canApply = creatorCanApply({ campaignType: offeringType, activeOfferingTypes: activeTypes });
  const typeLabel = TYPE_LABELS[offeringType] ?? offeringType.replace(/_/g, " ");

  if (!canApply) {
    return (
      <section className="mt-10 max-w-xl">
        <h2 className="text-lg font-bold">Apply to this campaign</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This campaign needs a {typeLabel} offering. Add one to your storefront, or ask the brand to book another format.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/dashboard?tab=offerings">Add a {typeLabel} offering</Link>
          </Button>
          {creatorProfile?.handle && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/c/${creatorProfile.handle}`}>View your storefront</Link>
            </Button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold">Apply to this campaign</h2>
      <div className="mt-3 gap-6 md:grid md:grid-cols-[1fr_280px]">
        <form action={applyToCampaign} className="flex max-w-xl flex-col gap-4">
          <input type="hidden" name="campaign_id" value={campaignId} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pitch">Your pitch</Label>
            <Textarea
              id="pitch"
              name="pitch"
              rows={5}
              required
              placeholder={pitchPlaceholder(offeringType)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="proposed_price">Your price (USD)</Label>
            <Input
              id="proposed_price"
              name="proposed_price"
              inputMode="decimal"
              required
              defaultValue={(Math.round((budgetMinCents + budgetMaxCents) / 2) / 100).toFixed(0)}
            />
            <p className="text-xs text-muted-foreground">
              Suggested from the brand&rsquo;s budget — adjust to your rate.
            </p>
          </div>
          <Button type="submit" className="mt-2 self-start">
            Submit application
          </Button>
        </form>

        <aside className="mt-6 h-fit rounded-xl border p-4 md:mt-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your profile</p>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            {totalFollowers > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Followers</dt>
                <dd className="font-semibold tabular-nums">{totalFollowers.toLocaleString("en-US")}</dd>
              </div>
            )}
            {avgRating !== null && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Rating</dt>
                <dd className="font-semibold"><span className="text-amber">★</span> {avgRating} ({(reviews ?? []).length})</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Completed deals</dt>
              <dd className="font-semibold tabular-nums">{completedDealCount ?? 0}</dd>
            </div>
            {(stats ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {(stats ?? []).map((s) => (
                  <Badge key={s.platform} variant="secondary" className="text-xs">
                    {s.platform}
                  </Badge>
                ))}
              </div>
            )}
          </dl>
        </aside>
      </div>
    </section>
  );
}
