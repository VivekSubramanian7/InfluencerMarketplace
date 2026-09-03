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
import { ReviewModal } from "@/components/deals/review-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS_LABELS: Record<string, string> = {
  requested: "Awaiting creator response", funded: "Funded",
  accepted: "Accepted, production starting", in_production: "In production",
  submitted: "Preview submitted", revision_requested: "Changes requested",
  published: "Published, awaiting brand approval", completed: "Completed",
  cancelled: "Cancelled", disputed: "Disputed, admin will review",
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
  const [{ data: brief }, { data: events }, { data: counterpartProfile }, { data: myReview }, { data: creatorHandle }] = await Promise.all([
    supabase.from("briefs").select("goals, product_description, talking_points").eq("deal_id", id).maybeSingle(),
    supabase.from("deal_events").select("action, from_status, to_status, created_at").eq("deal_id", id).order("created_at"),
    supabase.from("profiles").select("display_name")
      .eq("id", myRole === "brand" ? deal.creator_id : deal.brand_id).maybeSingle(),
    supabase.from("reviews").select("id").eq("deal_id", id).eq("author_id", user.id).maybeSingle(),
    supabase.from("creator_profiles").select("handle").eq("user_id", deal.creator_id).maybeSingle(),
  ]);

  let conversationMessages: { id: string; sender_id: string; body: string; created_at: string }[] = [];
  {
    const offerEvent = (events ?? []).find((e) => e.action === "offer_accepted");
    if (offerEvent) {
      const { data: fullEvent } = await supabase
        .from("deal_events")
        .select("metadata")
        .eq("deal_id", id)
        .eq("action", "offer_accepted")
        .maybeSingle();
      const convId = fullEvent?.metadata?.conversation_id;
      if (convId) {
        const { data } = await supabase
          .from("messages")
          .select("id, sender_id, body, created_at")
          .eq("conversation_id", convId)
          .order("created_at");
        conversationMessages = data ?? [];
      }
    }
  }

  const actions = role === "admin" ? [] :
    actionsFor(deal.status as DealStatus, myRole, deal.payment_mode as PaymentMode);

  const statusIsAttention = deal.status === "disputed" || deal.status === "published";

  const DEAL_STEPS = ["Booked", "Accepted", "In production", "Submitted", "Published", "Completed"] as const;
  const STATUS_TO_STEP: Record<string, number> = {
    requested: 0, funded: 0, accepted: 1, in_production: 2,
    submitted: 3, revision_requested: 3, published: 4, completed: 5,
    cancelled: -1, disputed: -1,
  };
  const currentStep = STATUS_TO_STEP[deal.status] ?? 0;

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <Link href="/deals" className="text-sm text-muted-foreground hover:underline">← All deals</Link>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{deal.offering_title}</h1>
      <p className="mt-1 text-muted-foreground">
        {myRole === "brand" ? "You booked" : "Booked by"}{" "}
        {creatorHandle?.handle && myRole === "brand" ? (
          <Link href={`/c/${creatorHandle.handle}`} className="font-medium text-foreground underline-offset-2 hover:underline">
            {counterpartProfile?.display_name ?? `@${creatorHandle.handle}`}
          </Link>
        ) : (
          <span className="font-medium text-foreground">{counterpartProfile?.display_name ?? "counterpart"}</span>
        )}
        {" · "}
        <span className="font-extrabold tabular-nums text-primary">
          ${(deal.price_cents / 100).toFixed(2)}
        </span>
      </p>

      {currentStep >= 0 && (
        <div className="mt-5 flex items-center gap-1" aria-label="Deal progress">
          {DEAL_STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full items-center">
                <div
                  className={`size-3 shrink-0 rounded-full transition-colors ${
                    i <= currentStep ? "bg-primary" : "bg-border"
                  }`}
                />
                {i < DEAL_STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 transition-colors ${
                      i < currentStep ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>
              <span className={`text-[10px] leading-tight ${
                i === currentStep ? "font-bold text-foreground" : "text-muted-foreground"
              }`}>
                {label}
              </span>
            </div>
          ))}
        </div>
      )}

      <div
        className={
          statusIsAttention
            ? "mt-4 flex items-center gap-3 rounded-2xl border border-amber bg-amber/10 px-5 py-4"
            : "mt-4 flex items-center gap-3 rounded-2xl bg-secondary px-5 py-4"
        }
      >
        {statusIsAttention && (
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-amber" />
        )}
        <span className="font-semibold">{STATUS_LABELS[deal.status] ?? deal.status}</span>
      </div>

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
          Thanks! Our team will take a look.
        </p>
      )}

      {(actions.length > 0 || (role !== "admin" && deal.status === "completed" && !myReview)) && (
        <section className="deal-next-steps sticky top-[72px] z-10 mt-4 rounded-2xl border border-amber bg-amber/10 p-6">
          <h2 className="flex items-center gap-2.5 text-base font-bold">
            <span aria-hidden className="size-2 rounded-full bg-amber" />
            Next steps
          </h2>
          {actions.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
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
          )}
          {deal.status === "completed" && !myReview && role !== "admin" && (
            <div className={actions.length > 0 ? "mt-3" : "mt-4"}>
              <ReviewModal dealId={deal.id} action={submitReview} />
            </div>
          )}
        </section>
      )}

      {(deal.preview_url || deal.live_url) && (
        <section className="mt-6 rounded-2xl bg-card p-6 shadow-card">
          <h2 className="text-base font-bold">Deliverables</h2>
          {deal.preview_url && (
            <p className="mt-3 text-sm">
              <span className="text-muted-foreground">Preview:</span>{" "}
              <a className="break-all font-medium underline underline-offset-2" href={deal.preview_url}
                target="_blank" rel="noopener noreferrer">{deal.preview_url}</a></p>
          )}
          {deal.live_url && (
            <p className="mt-1.5 text-sm">
              <span className="text-muted-foreground">Live post:</span>{" "}
              <a className="break-all font-medium underline underline-offset-2" href={deal.live_url}
                target="_blank" rel="noopener noreferrer">{deal.live_url}</a></p>
          )}
          <p className="mt-3 text-xs text-muted-foreground tabular-nums">
            Revisions used: {deal.revision_count} of {deal.revision_limit}
          </p>
        </section>
      )}

      {brief && (
        <section className="mt-6 rounded-2xl bg-card p-6 shadow-card">
          <h2 className="text-base font-bold">Brief</h2>
          <div className="mt-3 flex flex-col gap-3 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Goals</p>
              <p className="mt-1 whitespace-pre-line">{brief.goals}</p>
            </div>
            {brief.product_description && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product</p>
                <p className="mt-1 whitespace-pre-line">{brief.product_description}</p>
              </div>
            )}
            {brief.talking_points && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Talking points</p>
                <p className="mt-1 whitespace-pre-line">{brief.talking_points}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {conversationMessages.length > 0 && (
        <details className="mt-6 rounded-xl border p-5">
          <summary className="cursor-pointer text-base font-bold">
            Pre-deal discussion
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {conversationMessages.length} message{conversationMessages.length !== 1 ? "s" : ""}
            </span>
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {conversationMessages.map((m) => (
              <li
                key={m.id}
                className={`max-w-[85%] rounded-lg p-3 text-sm ${
                  m.sender_id === user.id
                    ? "self-end bg-primary/10 text-foreground"
                    : "self-start bg-secondary"
                }`}
              >
                <p className="whitespace-pre-line break-words">{m.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(m.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            Deal started
            <span className="h-px flex-1 bg-border" />
          </div>
        </details>
      )}

      <DealMessages dealId={deal.id} userId={user.id} />

      {role !== "admin" && myRole === "brand" && deal.payment_mode === "off_platform" &&
        !deal.marked_paid_at &&
        ["accepted", "in_production", "submitted", "revision_requested", "published", "completed"]
          .includes(deal.status) && (
        <form action={markPaid} className="mt-6">
          <input type="hidden" name="deal_id" value={deal.id} />
          <Button type="submit" variant="outline" size="sm">Confirm payment sent</Button>
        </form>
      )}

      <details className="mt-6 rounded-2xl bg-secondary/40 p-6">
        <summary className="flex cursor-pointer items-center justify-between">
          <span className="text-base font-bold">
            Timeline · {(events ?? []).length} event{(events ?? []).length !== 1 ? "s" : ""}
          </span>
          <Link href={`/report?deal=${deal.id}`} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Report a problem
          </Link>
        </summary>
        <ul className="mt-3 flex flex-col gap-0">
          {(events ?? []).map((e, i) => (
            <li key={i} className="relative flex gap-4 pb-4 last:pb-0">
              <div className="flex flex-col items-center">
                <span aria-hidden className="mt-1 size-2.5 rounded-full bg-primary" />
                {i < (events?.length ?? 1) - 1 && (
                  <span aria-hidden className="w-px flex-1 bg-border" />
                )}
              </div>
              <div className="min-w-0 pb-0.5 text-sm">
                <p className="font-medium">{e.action}
                  {e.from_status !== e.to_status ? ` (${e.from_status} → ${e.to_status})` : ""}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {new Date(e.created_at).toLocaleString()}
                </p>
              </div>
            </li>
          ))}
          {(events ?? []).length === 0 && (
            <li className="flex gap-4">
              <span aria-hidden className="mt-1 size-2.5 rounded-full bg-primary" />
              <div className="text-sm">
                <p className="font-medium">Requested</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {new Date(deal.requested_at).toLocaleString()}
                </p>
              </div>
            </li>
          )}
        </ul>
      </details>
      </main>
    </>
  );
}
