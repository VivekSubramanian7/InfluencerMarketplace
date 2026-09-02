import Link from "next/link";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { SiteNav } from "@/components/site-nav";
import { creatorGradient } from "@/lib/identity/gradient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

export default async function DashboardPage() {
  const { user, role } = await requireRole("creator", "/dashboard");
  const supabase = await createServerSupabase();

  const [
    { data: profile },
    { count: offeringCount },
    { count: portfolioCount },
    { count: socialCount },
    { data: deals },
    { data: myRatings },
  ] = await Promise.all([
    supabase.from("creator_profiles").select("handle, status").eq("user_id", user.id).maybeSingle(),
    supabase.from("offerings").select("id", { count: "exact", head: true }).eq("creator_id", user.id),
    supabase.from("portfolio_items").select("id", { count: "exact", head: true }).eq("creator_id", user.id),
    supabase.from("connected_accounts").select("id", { count: "exact", head: true }).eq("creator_id", user.id),
    supabase.from("deals")
      .select("id, offering_title, price_cents, status, requested_at")
      .eq("creator_id", user.id)
      .order("requested_at", { ascending: false }),
    supabase.from("public_creator_reviews").select("rating").eq("creator_id", user.id),
  ]);

  const allDeals = deals ?? [];
  const activeDeals = allDeals.filter((d) => ACTIVE_STATUSES.includes(d.status));
  const completedDeals = allDeals.filter((d) => d.status === "completed");
  const earnedCents = completedDeals.reduce((sum, d) => sum + d.price_cents, 0);
  const ratings = myRatings ?? [];
  const avgRating = ratings.length > 0
    ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10) / 10
    : null;
  const recentDeals = allDeals.slice(0, 4);

  const steps = [
    { done: !!profile, label: "Create your profile", href: "/onboarding/profile" },
    { done: (socialCount ?? 0) > 0, label: "Add your social accounts", href: "/onboarding/socials" },
    { done: (offeringCount ?? 0) > 0, label: "Add at least one offering", href: "/onboarding/offerings" },
    { done: (portfolioCount ?? 0) > 0, label: "Link portfolio videos", href: "/onboarding/highlights" },
    { done: profile?.status === "live", label: "Publish your storefront", href: "/onboarding/publish" },
  ];
  const openSteps = steps.filter((s) => !s.done);
  const gradient = profile ? creatorGradient(profile.handle) : null;

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Your studio</h1>
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

        {/* The business at a glance — every number is real */}
        <div className="card-grid mt-8 grid gap-4 sm:grid-cols-3">
          <div className="stat-card rounded-2xl bg-card p-6 shadow-card transition-shadow hover:shadow-card-hover">
            <p className="text-sm font-medium text-muted-foreground">Earned on Clipline</p>
            <p className="mt-2 text-3xl font-black tabular-nums">
              ${(earnedCents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {completedDeals.length} completed deal{completedDeals.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="stat-card rounded-2xl bg-card p-6 shadow-card transition-shadow hover:shadow-card-hover">
            <p className="text-sm font-medium text-muted-foreground">Active deals</p>
            <p className="mt-2 text-3xl font-black tabular-nums">{activeDeals.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeDeals.filter((d) => ["requested", "funded"].includes(d.status)).length} awaiting
              your response
            </p>
          </div>
          <div className="stat-card rounded-2xl bg-card p-6 shadow-card transition-shadow hover:shadow-card-hover">
            <p className="text-sm font-medium text-muted-foreground">Brand rating</p>
            <p className="mt-2 text-3xl font-black tabular-nums">
              {avgRating !== null ? (
                <>
                  <span className="text-amber">★</span> {avgRating}
                </>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {ratings.length > 0
                ? `${ratings.length} brand review${ratings.length === 1 ? "" : "s"}`
                : "No reviews yet, they arrive with completed deals"}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
          {/* Recent deals */}
          <section className="min-w-0 rounded-2xl bg-card p-6 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Recent deals</h2>
              <Link href="/deals" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                All deals →
              </Link>
            </div>
            {recentDeals.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                <span aria-hidden className="empty-icon mx-auto mb-3 block text-3xl">📬</span>
                <p className="font-semibold text-foreground">No bookings yet.</p>
                <p className="mt-1">
                  Share your storefront link. Every booking lands here with a brief,
                  a deadline, and anti-ghosting timers.
                </p>
              </div>
            ) : (
              <ul className="mt-4 flex flex-col gap-1.5">
                {recentDeals.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/deals/${d.id}`}
                      className="deal-row flex items-center justify-between gap-4 rounded-xl border border-transparent bg-secondary/40 px-4 py-3.5 transition-all hover:border-border hover:bg-card"
                    >
                      <span className="min-w-0 truncate font-semibold">{d.offering_title}</span>
                      <span className="flex shrink-0 items-center gap-3">
                        <Badge
                          variant="secondary"
                          className={
                            ["requested", "funded", "revision_requested"].includes(d.status)
                              ? "bg-amber text-amber-foreground hover:bg-amber"
                              : ""
                          }
                        >
                          {STATUS_LABELS[d.status] ?? d.status}
                        </Badge>
                        <span className="font-black tabular-nums">
                          ${(d.price_cents / 100).toFixed(0)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Storefront card + setup */}
          <aside className="flex min-w-0 flex-col gap-6">
            <section className="overflow-hidden rounded-2xl bg-card shadow-card">
              <div
                aria-hidden
                className="h-16"
                style={gradient ? { background: gradient.css } : { background: "var(--secondary)" }}
              />
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <p className="font-bold">
                    {profile ? `@${profile.handle}` : "Your storefront"}
                  </p>
                  {profile && (
                    <Badge
                      variant="secondary"
                      className={
                        profile.status === "live"
                          ? "bg-amber text-amber-foreground hover:bg-amber"
                          : ""
                      }
                    >
                      {profile.status}
                    </Badge>
                  )}
                </div>
                <div className="mt-4 flex flex-col gap-1.5 text-sm">
                  <Link className="text-muted-foreground hover:text-foreground" href="/dashboard/profile">
                    Edit profile →
                  </Link>
                  <Link className="text-muted-foreground hover:text-foreground" href="/onboarding/socials">
                    Socials ({socialCount ?? 0}) →
                  </Link>
                  <Link className="text-muted-foreground hover:text-foreground" href="/dashboard/offerings">
                    Offerings ({offeringCount ?? 0}) →
                  </Link>
                  <Link className="text-muted-foreground hover:text-foreground" href="/dashboard/portfolio">
                    Portfolio ({portfolioCount ?? 0}) →
                  </Link>
                </div>
              </div>
            </section>

            {openSteps.length > 0 && (
              <section className="rounded-2xl bg-card p-5 shadow-card">
                <h2 className="font-bold">
                  Finish setup{" "}
                  <span className="text-sm font-medium text-muted-foreground">
                    ({steps.length - openSteps.length + 1}/{steps.length + 1})
                  </span>
                </h2>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.round(((steps.length - openSteps.length + 1) / (steps.length + 1)) * 100)}%` }}
                  />
                </div>
                <ul className="mt-3 flex flex-col gap-2">
                  {openSteps.map((s) => (
                    <li key={s.label}>
                      <Link
                        href={s.href}
                        className="flex items-center gap-2.5 rounded-lg border border-dashed px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary/60"
                      >
                        <span
                          aria-hidden
                          className="grid size-5 shrink-0 place-items-center rounded-full border-2 border-border"
                        />
                        {s.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}
