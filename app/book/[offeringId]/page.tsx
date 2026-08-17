import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { createBooking } from "./actions";
import { SiteNav } from "@/components/site-nav";

export default async function BookOfferingPage({
  params, searchParams,
}: {
  params: Promise<{ offeringId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { offeringId } = await params;
  const { role } = await requireRole("brand", `/book/${offeringId}`);
  const { error } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: offering } = await supabase
    .from("offerings")
    .select("id, title, type, price_cents, turnaround_days, revision_limit, creator_id, active")
    .eq("id", offeringId)
    .maybeSingle();
  if (!offering || !offering.active) notFound();

  const { data: creator } = await supabase
    .from("creator_profiles")
    .select("handle")
    .eq("user_id", offering.creator_id)
    .maybeSingle();

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold mb-1">Book: {offering.title}</h1>
      <p className="text-gray-600 mb-6">
        {creator ? <>by @{creator.handle} · </> : null}
        ${(offering.price_cents / 100).toFixed(2)} · {offering.turnaround_days}d turnaround ·{" "}
        {offering.revision_limit} revision{offering.revision_limit === 1 ? "" : "s"}
      </p>
      <p className="mb-6 text-sm border rounded p-3 bg-gray-50">
        Payment is handled outside the platform for now — you and the creator
        agree on payment directly. The deal tracker keeps both sides honest.
      </p>
      {error && <p className="mb-4 text-red-600">{error}</p>}

      <form action={createBooking} className="flex flex-col gap-4">
        <input type="hidden" name="offering_id" value={offering.id} />
        <label className="flex flex-col gap-1">
          <span>Goals — what does success look like? *</span>
          <textarea name="goals" rows={4} className="border rounded p-2" required />
        </label>
        <label className="flex flex-col gap-1">
          <span>Product / service description</span>
          <textarea name="product_description" rows={3} className="border rounded p-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span>Key talking points</span>
          <textarea name="talking_points" rows={3} className="border rounded p-2" />
        </label>
        <button className="bg-black text-white rounded p-2">Send booking request</button>
      </form>
      </main>
    </>
  );
}
