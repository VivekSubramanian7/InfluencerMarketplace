import Link from "next/link";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { SiteNav } from "@/components/site-nav";

export default async function DashboardPage() {
  const { user, role } = await requireRole("creator", "/dashboard");
  const supabase = await createServerSupabase();

  const [{ data: profile }, { count: offeringCount }, { count: portfolioCount }] =
    await Promise.all([
      supabase.from("creator_profiles").select("handle, status").eq("user_id", user.id).maybeSingle(),
      supabase.from("offerings").select("id", { count: "exact", head: true }).eq("creator_id", user.id),
      supabase.from("portfolio_items").select("id", { count: "exact", head: true }).eq("creator_id", user.id),
    ]);

  const steps = [
    { done: !!profile, label: "Create your profile", href: "/dashboard/profile" },
    { done: (offeringCount ?? 0) > 0, label: "Add at least one offering", href: "/dashboard/offerings" },
    { done: (portfolioCount ?? 0) > 0, label: "Link portfolio videos", href: "/dashboard/portfolio" },
    { done: profile?.status === "live", label: "Publish your storefront", href: "/dashboard/profile" },
  ];

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">Creator dashboard</h1>

        {profile?.status === "live" ? (
          <p className="mt-1 text-muted-foreground">
            Your storefront is live:{" "}
            <a className="font-medium text-primary underline" href={`/c/${profile.handle}`}>
              /c/{profile.handle}
            </a>
          </p>
        ) : (
          <p className="mt-1 text-muted-foreground">Complete these steps to go live:</p>
        )}

        <ol className="mt-6 flex flex-col gap-3">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-3 rounded-xl border p-5">
              <span
                aria-hidden
                className={
                  s.done
                    ? "grid size-6 shrink-0 place-items-center rounded-full bg-ok text-white"
                    : "size-6 shrink-0 rounded-full border-2"
                }
              >
                {s.done && (
                  <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
                    <path
                      d="M3 8.5l3 3 7-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <Link className="font-medium text-primary hover:underline" href={s.href}>
                {s.label}
              </Link>
            </li>
          ))}
        </ol>
      </main>
    </>
  );
}
