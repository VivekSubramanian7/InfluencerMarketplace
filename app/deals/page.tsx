import Link from "next/link";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { actionsFor } from "@/lib/deals/ui-actions";
import type { DealStatus, PaymentMode } from "@/lib/deals/machine";

const STATUS_LABELS: Record<string, string> = {
  requested: "Awaiting creator", funded: "Funded",
  accepted: "Accepted", in_production: "In production",
  submitted: "Preview submitted", revision_requested: "Changes requested",
  published: "Published — awaiting approval", completed: "Completed",
  cancelled: "Cancelled", disputed: "Disputed",
};

const DONE: DealStatus[] = ["completed", "cancelled"];

export default async function DealsPage() {
  const { user, role } = await requireUser();
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
  const inFlight = mine.filter(
    (d) => !DONE.includes(d.status as DealStatus) && !needsMe.includes(d)
  );
  const done = mine.filter((d) => DONE.includes(d.status as DealStatus));

  const section = (title: string, rows: typeof mine) => (
    <section className="mb-8">
      <h2 className="text-lg font-medium mb-3">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing here.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((d) => (
            <li key={d.id}>
              <Link href={`/deals/${d.id}`}
                className="border rounded p-4 flex justify-between items-center gap-4 hover:bg-gray-50">
                <span className="min-w-0 truncate">
                  {d.offering_title}
                  <span className="text-gray-500"> · {myRole(d) === "brand" ? "buying" : "selling"}</span>
                </span>
                <span className="flex items-center gap-4 shrink-0">
                  <span className="text-sm text-gray-600">{STATUS_LABELS[d.status] ?? d.status}</span>
                  <span>${(d.price_cents / 100).toFixed(2)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Your deals</h1>
        <Link className="text-sm underline"
          href={role === "creator" ? "/dashboard" : "/discover"}>
          {role === "creator" ? "Dashboard" : "Find creators"}
        </Link>
      </div>
      {section("Action needed", needsMe)}
      {section("In progress", inFlight)}
      {section("Done", done)}
    </main>
  );
}
