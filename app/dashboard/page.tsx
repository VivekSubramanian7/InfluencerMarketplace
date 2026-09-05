import Link from "next/link";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { creatorGradient } from "@/lib/identity/gradient";
import { AuthenticatedShell } from "@/components/authenticated-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SendIcon } from "@/components/ui/icons";
import { ProfileForm } from "@/components/creator/profile-form";
import { OfferingsPanel } from "@/components/creator/offerings-panel";
import { PortfolioPanel } from "@/components/creator/portfolio-panel";
import { saveCreatorProfile, setProfileStatus } from "./profile/actions";
import { saveOffering, toggleOffering, deleteOffering } from "./offerings/actions";
import { addPortfolioItem, deletePortfolioItem } from "./portfolio/actions";

const ACTIVE_STATUSES = [
  "requested", "funded", "accepted", "in_production",
  "submitted", "revision_requested", "published",
];

const STATUS_LABELS: Record<string, string> = {
  requested: "Awaiting your response", funded: "Funded, respond",
  accepted: "Accepted", in_production: "In production",
  submitted: "Preview submitted", revision_requested: "Changes requested",
  published: "Awaiting brand approval", completed: "Completed",
  cancelled: "Cancelled", disputed: "Disputed",
};

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "profile", label: "Profile" },
  { value: "offerings", label: "Offerings" },
  { value: "portfolio", label: "Portfolio" },
] as const;

type Tab = (typeof TABS)[number]["value"];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string; saved?: string }>;
}) {
  const { user, role } = await requireRole("creator", "/dashboard");
  const { tab: rawTab, error, saved } = await searchParams;
  const activeTab: Tab = TABS.some((t) => t.value === rawTab) ? (rawTab as Tab) : "overview";
  const supabase = await createServerSupabase();

  const [
    { data: profile },
    { count: offeringCount },
    { count: portfolioCount },
    { count: socialCount },
  ] = await Promise.all([
    supabase.from("creator_profiles").select("handle, bio, niches, country, languages, status").eq("user_id", user.id).maybeSingle(),
    supabase.from("offerings").select("id", { count: "exact", head: true }).eq("creator_id", user.id),
    supabase.from("portfolio_items").select("id", { count: "exact", head: true }).eq("creator_id", user.id),
    supabase.from("connected_accounts").select("id", { count: "exact", head: true }).eq("creator_id", user.id),
  ]);

  const deals = activeTab === "overview"
    ? (await supabase.from("deals").select("id, offering_title, price_cents, status, requested_at").eq("creator_id", user.id).order("requested_at", { ascending: false })).data
    : null;
  const myRatings = activeTab === "overview"
    ? (await supabase.from("public_creator_reviews").select("rating").eq("creator_id", user.id)).data
    : null;
  const offerings = activeTab === "offerings"
    ? (await supabase.from("offerings").select("id, type, title, description, price_cents, turnaround_days, revision_limit, active").eq("creator_id", user.id).order("created_at", { ascending: false })).data
    : null;
  const portfolioItems = activeTab === "portfolio"
    ? (await supabase.from("portfolio_items").select("id, media_url, caption").eq("creator_id", user.id).order("created_at", { ascending: false })).data
    : null;

  const gradient = profile ? creatorGradient(profile.handle) : null;

  return (
    <AuthenticatedShell userId={user.id} role={role}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your studio</h1>
            <p className="mt-1 text-muted-foreground">
              {profile?.status === "live"
                ? "Your storefront is live and bookable."
                : "Finish setup to open for bookings."}
            </p>
          </div>
          {profile?.status === "live" && (
            <Button asChild className="px-5">
              <a href={`/c/${profile.handle}`}>View storefront</a>
            </Button>
          )}
        </div>

        <nav className="mt-6 flex gap-1 border-b" aria-label="Dashboard tabs">
          {TABS.map((t) => {
            const active = activeTab === t.value;
            return (
              <Link
                key={t.value}
                href={t.value === "overview" ? "/dashboard" : `/dashboard?tab=${t.value}`}
                className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        {activeTab === "overview" && (
          <OverviewTab
            profile={profile}
            deals={deals ?? []}
            myRatings={myRatings ?? []}
            offeringCount={offeringCount ?? 0}
            portfolioCount={portfolioCount ?? 0}
            socialCount={socialCount ?? 0}
            gradient={gradient}
          />
        )}

        {activeTab === "profile" && (
          <div className="mt-6 max-w-2xl">
            <h2 className="text-2xl font-extrabold tracking-tight">Your creator profile</h2>
            <ProfileForm
              profile={profile}
              action={saveCreatorProfile}
              statusAction={setProfileStatus}
              mode="settings"
              error={error}
              saved={saved}
            />
          </div>
        )}

        {activeTab === "offerings" && (
          <div className="mt-6 max-w-2xl">
            <h2 className="text-2xl font-extrabold tracking-tight">Your offerings</h2>
            <OfferingsPanel
              offerings={offerings ?? []}
              saveAction={saveOffering}
              toggleAction={toggleOffering}
              deleteAction={deleteOffering}
              mode="settings"
              error={error}
              saved={saved}
            />
          </div>
        )}

        {activeTab === "portfolio" && (
          <div className="mt-6 max-w-4xl">
            <h2 className="text-2xl font-extrabold tracking-tight">Your portfolio</h2>
            <PortfolioPanel
              items={portfolioItems ?? []}
              addAction={addPortfolioItem}
              deleteAction={deletePortfolioItem}
              mode="settings"
              handle={profile?.handle ?? undefined}
              gradientSeed={profile?.handle ?? user.id}
              error={error}
              saved={saved}
            />
          </div>
        )}
    </AuthenticatedShell>
  );
}

function OverviewTab({
  profile,
  deals,
  myRatings,
  offeringCount,
  portfolioCount,
  socialCount,
  gradient,
}: {
  profile: { handle: string; status: string } | null;
  deals: { id: string; offering_title: string; price_cents: number; status: string; requested_at: string }[];
  myRatings: { rating: number }[];
  offeringCount: number;
  portfolioCount: number;
  socialCount: number;
  gradient: { css: string; deep: string } | null;
}) {
  const allDeals = deals;
  const activeDeals = allDeals.filter((d) => ACTIVE_STATUSES.includes(d.status));
  const completedDeals = allDeals.filter((d) => d.status === "completed");
  const earnedCents = completedDeals.reduce((sum, d) => sum + d.price_cents, 0);
  const avgRating = myRatings.length > 0
    ? Math.round((myRatings.reduce((s, r) => s + r.rating, 0) / myRatings.length) * 10) / 10
    : null;
  const recentDeals = allDeals.slice(0, 4);

  const steps = [
    { done: !!profile, label: "Create your profile", href: "/onboarding/profile" },
    { done: socialCount > 0, label: "Add your social accounts", href: "/onboarding/socials" },
    { done: offeringCount > 0, label: "Add at least one offering", href: "/onboarding/offerings" },
    { done: portfolioCount > 0, label: "Link portfolio videos", href: "/onboarding/highlights" },
    { done: profile?.status === "live", label: "Publish your storefront", href: "/onboarding/publish" },
  ];
  const openSteps = steps.filter((s) => !s.done);

  return (
    <>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-tile)] border border-[var(--border)] p-4">
          <p className="text-xl font-semibold tabular-nums">
            ${(earnedCents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Earned
          </p>
        </div>
        <div className="rounded-[var(--radius-tile)] border border-[var(--border)] p-4">
          <p className="text-xl font-semibold tabular-nums">{activeDeals.length}</p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Active deals
          </p>
        </div>
        <div className="rounded-[var(--radius-tile)] border border-[var(--border)] p-4">
          <p className="text-xl font-semibold tabular-nums">
            {avgRating !== null ? avgRating : "—"}
          </p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            {avgRating !== null ? "Brand rating" : "No rating yet"}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="min-w-0 rounded-[var(--radius-tile)] border border-[var(--border)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Recent deals</h2>
            <Link href="/deals" className="text-sm font-medium text-muted-foreground hover:text-foreground">All deals →</Link>
          </div>
          {recentDeals.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              <span aria-hidden className="mx-auto mb-3 block w-fit text-muted-foreground/40"><SendIcon size={36} /></span>
              <p className="font-semibold text-foreground">No bookings yet.</p>
              <p className="mt-1">Share your storefront link. Every booking lands here with a brief, a deadline, and anti-ghosting timers.</p>
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-1.5">
              {recentDeals.map((d) => (
                <li key={d.id}>
                  <Link href={`/deals/${d.id}`} className="deal-row flex items-center justify-between gap-4 rounded-xl border border-transparent bg-secondary/40 px-4 py-3.5 transition-all hover:border-border hover:bg-card">
                    <span className="min-w-0 truncate font-semibold">{d.offering_title}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <Badge variant="secondary" className={["requested", "funded", "revision_requested"].includes(d.status) ? "bg-amber text-amber-foreground hover:bg-amber" : ""}>
                        {STATUS_LABELS[d.status] ?? d.status}
                      </Badge>
                      <span className="font-black tabular-nums">${(d.price_cents / 100).toFixed(0)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-6">
          <section className="overflow-hidden rounded-[var(--radius-tile)] border border-[var(--border)]">
            <div aria-hidden className="h-16" style={gradient ? { background: gradient.css } : { background: "var(--secondary)" }} />
            <div className="p-5">
              <div className="flex items-center justify-between">
                <p className="font-bold">{profile ? `@${profile.handle}` : "Your storefront"}</p>
                {profile && (
                  <Badge variant="secondary" className={profile.status === "live" ? "bg-amber text-amber-foreground hover:bg-amber" : ""}>
                    {profile.status}
                  </Badge>
                )}
              </div>
              <div className="mt-4 flex flex-col gap-1.5 text-sm">
                <Link className="text-muted-foreground hover:text-foreground" href="/dashboard?tab=profile">Edit profile →</Link>
                <Link className="text-muted-foreground hover:text-foreground" href="/onboarding/socials">Socials ({socialCount}) →</Link>
                <Link className="text-muted-foreground hover:text-foreground" href="/dashboard?tab=offerings">Offerings ({offeringCount}) →</Link>
                <Link className="text-muted-foreground hover:text-foreground" href="/dashboard?tab=portfolio">Portfolio ({portfolioCount}) →</Link>
              </div>
            </div>
          </section>

          {openSteps.length > 0 && (
            <section className="rounded-[var(--radius-tile)] border border-[var(--border)] p-5">
              <h2 className="font-bold">
                Finish setup{" "}
                <span className="text-sm font-medium text-muted-foreground">
                  ({steps.length - openSteps.length + 1}/{steps.length + 1})
                </span>
              </h2>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round(((steps.length - openSteps.length + 1) / (steps.length + 1)) * 100)}%` }} />
              </div>
              <ul className="mt-3 flex flex-col gap-2">
                {openSteps.map((s) => (
                  <li key={s.label}>
                    <Link href={s.href} className="flex items-center gap-2.5 rounded-lg border border-dashed px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary/60">
                      <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full border-2 border-border" />
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
