import Link from "next/link";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { logout } from "@/app/(auth)/actions";

export default async function DashboardPage() {
  const { user } = await requireRole("creator");
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
    <main className="mx-auto max-w-xl p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Creator dashboard</h1>
        <form action={logout}><button className="text-sm underline">Log out</button></form>
      </div>

      {profile?.status === "live" ? (
        <p className="mb-6">
          Your storefront is live:{" "}
          <a className="underline font-medium" href={`/c/${profile.handle}`}>/c/{profile.handle}</a>
        </p>
      ) : (
        <p className="mb-6 text-gray-600">Complete these steps to go live:</p>
      )}

      <ol className="flex flex-col gap-3">
        {steps.map((s) => (
          <li key={s.label} className="border rounded p-4 flex items-center gap-3">
            <span aria-hidden>{s.done ? "✅" : "⬜"}</span>
            <Link className="underline" href={s.href}>{s.label}</Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
