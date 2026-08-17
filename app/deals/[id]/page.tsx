import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { actionsFor } from "@/lib/deals/ui-actions";
import type { DealStatus, PaymentMode } from "@/lib/deals/machine";
import { markPaid, performDealAction } from "./actions";
import { submitReview } from "./review-actions";
import { DealMessages } from "./messages";

const STATUS_LABELS: Record<string, string> = {
  requested: "Awaiting creator response", funded: "Funded",
  accepted: "Accepted — production starting", in_production: "In production",
  submitted: "Preview submitted", revision_requested: "Changes requested",
  published: "Published — awaiting brand approval", completed: "Completed",
  cancelled: "Cancelled", disputed: "Disputed — admin will review",
};

export default async function DealPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { user, role } = await requireUser();
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: deal } = await supabase
    .from("deals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!deal) notFound(); // RLS hides other people's deals

  const myRole = deal.brand_id === user.id ? "brand" : "creator";
  const [{ data: brief }, { data: events }, { data: counterpartProfile }, { data: myReview }] = await Promise.all([
    supabase.from("briefs").select("goals, product_description, talking_points").eq("deal_id", id).maybeSingle(),
    supabase.from("deal_events").select("action, from_status, to_status, created_at").eq("deal_id", id).order("created_at"),
    supabase.from("profiles").select("display_name")
      .eq("id", myRole === "brand" ? deal.creator_id : deal.brand_id).maybeSingle(),
    supabase.from("reviews").select("id").eq("deal_id", id).eq("author_id", user.id).maybeSingle(),
  ]);

  const actions = role === "admin" ? [] :
    actionsFor(deal.status as DealStatus, myRole, deal.payment_mode as PaymentMode);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Link href="/deals" className="text-sm underline">← All deals</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">{deal.offering_title}</h1>
      <p className="text-gray-600 mb-1">
        {myRole === "brand" ? "You booked" : "Booked by"}{" "}
        {counterpartProfile?.display_name ?? "counterpart"} · ${(deal.price_cents / 100).toFixed(2)}
      </p>
      <p className="mb-4 font-medium">{STATUS_LABELS[deal.status] ?? deal.status}</p>

      {deal.payment_mode === "off_platform" && (
        <p className="mb-4 text-sm border rounded p-3 bg-amber-50">
          Payment for this deal is handled outside the platform.
          {deal.marked_paid_at
            ? ` The brand marked it paid on ${new Date(deal.marked_paid_at).toLocaleDateString()}.`
            : " Agree on payment directly with your counterpart."}
        </p>
      )}
      {error && <p className="mb-4 text-red-600">{error}</p>}

      {(deal.preview_url || deal.live_url) && (
        <section className="mb-6 border rounded p-4">
          <h2 className="font-medium mb-2">Deliverables</h2>
          {deal.preview_url && (
            <p className="text-sm">Preview:{" "}
              <a className="underline break-all" href={deal.preview_url}
                target="_blank" rel="noopener noreferrer">{deal.preview_url}</a></p>
          )}
          {deal.live_url && (
            <p className="text-sm">Live post:{" "}
              <a className="underline break-all" href={deal.live_url}
                target="_blank" rel="noopener noreferrer">{deal.live_url}</a></p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Revisions used: {deal.revision_count} of {deal.revision_limit}
          </p>
        </section>
      )}

      {brief && (
        <section className="mb-6 border rounded p-4">
          <h2 className="font-medium mb-2">Brief</h2>
          <p className="text-sm whitespace-pre-line mb-2"><strong>Goals:</strong> {brief.goals}</p>
          {brief.product_description && (
            <p className="text-sm whitespace-pre-line mb-2">
              <strong>Product:</strong> {brief.product_description}</p>
          )}
          {brief.talking_points && (
            <p className="text-sm whitespace-pre-line">
              <strong>Talking points:</strong> {brief.talking_points}</p>
          )}
        </section>
      )}

      <DealMessages dealId={deal.id} userId={user.id} />

      {actions.length > 0 && (
        <section className="mb-6 border rounded p-4">
          <h2 className="font-medium mb-3">Next steps</h2>
          <div className="flex flex-col gap-3">
            {actions.map((a) => (
              <form key={a.action} action={performDealAction} className="flex gap-2 items-start">
                <input type="hidden" name="deal_id" value={deal.id} />
                <input type="hidden" name="action" value={a.action} />
                {a.needsUrl && (
                  <input name="url" type="url" required
                    placeholder={a.needsUrl === "preview_url" ? "Link to your preview" : "Link to the live post"}
                    className="border rounded p-2 flex-1" />
                )}
                <button
                  className={a.confirm
                    ? "border border-red-300 text-red-700 rounded px-4 py-2"
                    : "bg-black text-white rounded px-4 py-2"}>
                  {a.label}
                </button>
              </form>
            ))}
          </div>
        </section>
      )}

      {role !== "admin" && myRole === "brand" && deal.payment_mode === "off_platform" &&
        !deal.marked_paid_at &&
        ["accepted", "in_production", "submitted", "revision_requested", "published", "completed"]
          .includes(deal.status) && (
        <form action={markPaid} className="mb-6">
          <input type="hidden" name="deal_id" value={deal.id} />
          <button className="border rounded px-4 py-2 text-sm">Mark as paid</button>
        </form>
      )}

      {deal.status === "completed" && !myReview && (
        <section className="mb-6 border rounded p-4">
          <h2 className="font-medium mb-3">Leave a review</h2>
          <form action={submitReview} className="flex flex-col gap-3">
            <input type="hidden" name="deal_id" value={deal.id} />
            <label className="flex items-center gap-2">
              <span>Rating</span>
              <select name="rating" className="border rounded p-2" defaultValue="5">
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <textarea name="body" rows={3} placeholder="How was the collaboration?"
              className="border rounded p-2" />
            <button className="bg-black text-white rounded p-2 self-start px-6">Submit review</button>
          </form>
        </section>
      )}

      <section className="mb-6">
        <h2 className="font-medium mb-2">Timeline</h2>
        <ul className="text-sm text-gray-600 flex flex-col gap-1">
          {(events ?? []).map((e, i) => (
            <li key={i}>
              {new Date(e.created_at).toLocaleString()} — {e.action}
              {e.from_status !== e.to_status ? ` (${e.from_status} → ${e.to_status})` : ""}
            </li>
          ))}
          {(events ?? []).length === 0 && <li>Requested {new Date(deal.requested_at).toLocaleString()}</li>}
        </ul>
      </section>
    </main>
  );
}
