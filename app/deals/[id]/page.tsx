import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { actionsFor } from "@/lib/deals/ui-actions";
import type { DealStatus, PaymentMode } from "@/lib/deals/machine";
import { markPaid, performDealAction } from "./actions";
import { submitReview } from "./review-actions";
import { DealMessages } from "./messages";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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
  searchParams: Promise<{ error?: string; reported?: string }>;
}) {
  const { id } = await params;
  const { user, role } = await requireUser(`/deals/${id}`);
  const { error, reported } = await searchParams;
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

  const statusIsAttention = deal.status === "disputed" || deal.status === "published";

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <Link href="/deals" className="text-sm text-muted-foreground hover:underline">← All deals</Link>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{deal.offering_title}</h1>
      <p className="mt-1 text-muted-foreground">
        {myRole === "brand" ? "You booked" : "Booked by"}{" "}
        {counterpartProfile?.display_name ?? "counterpart"} ·{" "}
        <span className="font-extrabold tabular-nums text-primary">
          ${(deal.price_cents / 100).toFixed(2)}
        </span>
      </p>
      <p
        className={
          statusIsAttention
            ? "mt-4 rounded-lg border border-amber bg-amber/15 px-4 py-3 font-semibold"
            : "mt-4 rounded-lg bg-secondary px-4 py-3 font-semibold"
        }
      >
        {STATUS_LABELS[deal.status] ?? deal.status}
      </p>

      {deal.payment_mode === "off_platform" && (
        <p className="mt-4 rounded-lg border border-amber bg-amber/15 px-4 py-3 text-sm">
          Payment for this deal is handled outside the platform.
          {deal.marked_paid_at
            ? ` The brand marked it paid on ${new Date(deal.marked_paid_at).toLocaleDateString()}.`
            : " Agree on payment directly with your counterpart."}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {reported && (
        <p className="mt-4 rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
          Thanks — our team will take a look.
        </p>
      )}

      {(deal.preview_url || deal.live_url) && (
        <section className="mt-6 rounded-xl border p-5">
          <h2 className="text-base font-bold">Deliverables</h2>
          {deal.preview_url && (
            <p className="mt-2 text-sm">Preview:{" "}
              <a className="break-all text-primary underline" href={deal.preview_url}
                target="_blank" rel="noopener noreferrer">{deal.preview_url}</a></p>
          )}
          {deal.live_url && (
            <p className="mt-1 text-sm">Live post:{" "}
              <a className="break-all text-primary underline" href={deal.live_url}
                target="_blank" rel="noopener noreferrer">{deal.live_url}</a></p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Revisions used: {deal.revision_count} of {deal.revision_limit}
          </p>
        </section>
      )}

      {brief && (
        <section className="mt-6 rounded-xl border p-5">
          <h2 className="text-base font-bold">Brief</h2>
          <p className="mt-2 whitespace-pre-line text-sm"><strong>Goals:</strong> {brief.goals}</p>
          {brief.product_description && (
            <p className="mt-2 whitespace-pre-line text-sm">
              <strong>Product:</strong> {brief.product_description}</p>
          )}
          {brief.talking_points && (
            <p className="mt-2 whitespace-pre-line text-sm">
              <strong>Talking points:</strong> {brief.talking_points}</p>
          )}
        </section>
      )}

      <DealMessages dealId={deal.id} userId={user.id} />

      {actions.length > 0 && (
        <section className="mt-6 rounded-xl border p-5">
          <h2 className="text-base font-bold">Next steps</h2>
          <div className="mt-3 flex flex-col gap-3">
            {actions.map((a) => (
              <form key={a.action} action={performDealAction} className="flex items-start gap-2">
                <input type="hidden" name="deal_id" value={deal.id} />
                <input type="hidden" name="action" value={a.action} />
                {a.needsUrl && (
                  <Input
                    name="url"
                    type="url"
                    required
                    placeholder={a.needsUrl === "preview_url" ? "Link to your preview" : "Link to the live post"}
                    aria-label={a.needsUrl === "preview_url" ? "Link to your preview" : "Link to the live post"}
                    className="flex-1"
                  />
                )}
                <Button
                  type="submit"
                  variant={a.confirm ? "outline" : "default"}
                  className={a.confirm ? "text-destructive border-destructive/40" : undefined}
                >
                  {a.label}
                </Button>
              </form>
            ))}
          </div>
        </section>
      )}

      {role !== "admin" && myRole === "brand" && deal.payment_mode === "off_platform" &&
        !deal.marked_paid_at &&
        ["accepted", "in_production", "submitted", "revision_requested", "published", "completed"]
          .includes(deal.status) && (
        <form action={markPaid} className="mt-6">
          <input type="hidden" name="deal_id" value={deal.id} />
          <Button type="submit" variant="outline" size="sm">Mark as paid</Button>
        </form>
      )}

      {role !== "admin" && deal.status === "completed" && !myReview && (
        <section className="mt-6 rounded-xl border p-5">
          <h2 className="text-base font-bold">Leave a review</h2>
          <form action={submitReview} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="deal_id" value={deal.id} />
            <div className="flex items-center gap-2">
              <Label htmlFor="rating">Rating</Label>
              <select
                id="rating"
                name="rating"
                className="h-10 rounded-lg border bg-background px-3 text-sm"
                defaultValue="5"
              >
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <Textarea name="body" rows={3} placeholder="How was the collaboration?" />
            <Button type="submit" className="self-start px-6">Submit review</Button>
          </form>
        </section>
      )}

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Timeline</h2>
          <Link href={`/report?deal=${deal.id}`} className="text-xs text-muted-foreground underline">
            Report a problem
          </Link>
        </div>
        <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
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
    </>
  );
}
