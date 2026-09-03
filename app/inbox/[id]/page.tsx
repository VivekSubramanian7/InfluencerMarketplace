import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { draftReply, respondInvite, respondOffer, sendOffer, sendThreadMessage } from "../actions";
import { AutoScroll } from "@/components/inbox/auto-scroll";
import { SubmitButton } from "@/components/ui/submit-button";
import { blockCreator } from "@/app/brand/actions";
import { SiteNav } from "@/components/site-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const OFFER_LABELS: Record<string, string> = {
  pending: "Awaiting response",
  accepted: "Accepted",
  declined: "Declined",
};

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { user, role } = await requireUser(`/inbox/${id}`);
  const { error, saved } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, brand_id, creator_id, status, invite_message, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!conv) notFound();

  const iAmBrand = conv.brand_id === user.id;
  const otherId = iAmBrand ? conv.creator_id : conv.brand_id;

  const [
    { data: otherProfile },
    { data: brandProfile },
    { data: creatorProfile },
    offeringCountRes,
    dealCountRes,
  ] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", otherId).maybeSingle(),
    iAmBrand
      ? Promise.resolve({ data: null })
      : supabase.from("brand_profiles").select("company").eq("user_id", conv.brand_id).maybeSingle(),
    supabase
      .from("creator_profiles")
      .select("handle")
      .eq("user_id", conv.creator_id)
      .maybeSingle(),
    iAmBrand
      ? supabase
          .from("offerings")
          .select("id", { count: "exact", head: true })
          .eq("creator_id", conv.creator_id)
          .eq("active", true)
      : Promise.resolve({ count: null }),
    iAmBrand
      ? supabase
          .from("deals")
          .select("id", { count: "exact", head: true })
          .eq("brand_id", conv.brand_id)
          .eq("creator_id", conv.creator_id)
      : Promise.resolve({ count: null }),
  ]);
  const activeOfferings = offeringCountRes.count ?? 0;
  const pastDeals = dealCountRes.count ?? 0;
  const otherLabel =
    (!iAmBrand ? brandProfile?.company : null) || otherProfile?.display_name || "Someone";

  const [{ data: messages }, { data: offers }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", conv.id)
      .order("created_at"),
    supabase
      .from("offers")
      .select("id, offering_id, price_cents, note, status, deal_id, created_at")
      .eq("conversation_id", conv.id)
      .order("created_at"),
  ]);

  // brand composes offers from the creator's active offerings
  const { data: offerings } = iAmBrand && conv.status === "accepted"
    ? await supabase
        .from("offerings")
        .select("id, title, price_cents")
        .eq("creator_id", conv.creator_id)
        .eq("active", true)
        .order("price_cents")
    : { data: null };

  const offeringIds = [...new Set((offers ?? []).map((o) => o.offering_id))];
  const offeringTitleById = new Map<string, string>();
  if (offeringIds.length > 0) {
    const { data: rows } = await supabase
      .from("offerings")
      .select("id, title")
      .in("id", offeringIds);
    for (const r of rows ?? []) offeringTitleById.set(r.id, r.title);
  }

  const hasPendingOffer = (offers ?? []).some((o) => o.status === "pending");

  const { data: draft } = iAmBrand
    ? await supabase
        .from("agent_drafts")
        .select("body")
        .eq("conversation_id", conv.id)
        .maybeSingle()
    : { data: null };

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <AutoScroll />
        <Link href="/inbox" className="text-sm text-muted-foreground hover:text-foreground">
          ← Inbox
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight">{otherLabel}</h1>
          <span className="flex items-center gap-3">
            {iAmBrand && creatorProfile?.handle && (
              <Link
                href={`/c/${creatorProfile.handle}`}
                className="text-sm font-medium text-muted-foreground underline-offset-2 hover:underline"
              >
                @{creatorProfile.handle}
              </Link>
            )}
            {iAmBrand && conv.status === "accepted" && hasPendingOffer && (
              <Badge variant="secondary">
                Offer pending — ${((offers ?? []).find((o) => o.status === "pending")?.price_cents ?? 0) / 100}
              </Badge>
            )}
            {iAmBrand && conv.status === "accepted" && !hasPendingOffer && (offerings ?? []).length > 0 && (
              <a href="#offer-section" className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90">
                Make an offer
              </a>
            )}
            <Badge variant="secondary">
              {conv.status === "invited" ? "Invite pending" : conv.status === "declined" ? "Declined" : "Active"}
            </Badge>
          </span>
        </div>
        {iAmBrand && (activeOfferings > 0 || pastDeals > 0) && (
          <p className="mt-1 text-sm text-muted-foreground">
            {activeOfferings > 0 && (
              <span>
                {activeOfferings} active offering{activeOfferings !== 1 ? "s" : ""}
              </span>
            )}
            {activeOfferings > 0 && pastDeals > 0 && <span> · </span>}
            {pastDeals > 0 && (
              <span>
                {pastDeals} past deal{pastDeals !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {saved && (
          <p className="mt-4 rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
            Offer sent.
          </p>
        )}

        <div className="mt-6 rounded-xl border bg-secondary/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Invitation
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{conv.invite_message}</p>
        </div>

        {conv.status === "invited" && !iAmBrand && (
          <div className="mt-4 flex gap-2">
            <form action={respondInvite}>
              <input type="hidden" name="conversation_id" value={conv.id} />
              <input type="hidden" name="response" value="accepted" />
              <Button type="submit" size="sm">Accept &amp; chat</Button>
            </form>
            <form action={respondInvite}>
              <input type="hidden" name="conversation_id" value={conv.id} />
              <input type="hidden" name="response" value="declined" />
              <Button type="submit" variant="outline" size="sm">Decline</Button>
            </form>
          </div>
        )}
        {conv.status === "invited" && iAmBrand && (
          <p className="mt-4 text-sm text-muted-foreground">
            Waiting for {otherLabel} to respond.
          </p>
        )}
        {conv.status === "declined" && (
          <p className="mt-4 text-sm text-muted-foreground">
            This invitation was declined.
          </p>
        )}

        {(offers ?? []).length > 0 && (
          <section className="mt-6">
            <h2 className="text-base font-bold">Offers</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {(offers ?? []).map((o) => (
                <li key={o.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">
                      {offeringTitleById.get(o.offering_id) ?? "Offering"}
                    </span>
                    <span className="flex items-center gap-3">
                      <Badge variant="secondary">{OFFER_LABELS[o.status] ?? o.status}</Badge>
                      <span className="font-extrabold tabular-nums text-primary">
                        ${(o.price_cents / 100).toFixed(2)}
                      </span>
                    </span>
                  </div>
                  {o.note && <p className="mt-2 whitespace-pre-wrap text-sm">{o.note}</p>}
                  {o.status === "pending" && !iAmBrand && (
                    <div className="mt-3 flex gap-2">
                      <form action={respondOffer}>
                        <input type="hidden" name="offer_id" value={o.id} />
                        <input type="hidden" name="conversation_id" value={conv.id} />
                        <input type="hidden" name="response" value="accepted" />
                        <Button type="submit" size="sm">Accept and start the deal</Button>
                      </form>
                      <form action={respondOffer}>
                        <input type="hidden" name="offer_id" value={o.id} />
                        <input type="hidden" name="conversation_id" value={conv.id} />
                        <input type="hidden" name="response" value="declined" />
                        <Button type="submit" variant="outline" size="sm">Decline</Button>
                      </form>
                    </div>
                  )}
                  {o.status === "accepted" && o.deal_id && (
                    <p className="mt-2 text-sm">
                      <Link
                        href={`/deals/${o.deal_id}`}
                        className="font-medium underline underline-offset-2"
                      >
                        Open the deal →
                      </Link>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {conv.status === "accepted" && (
          <section className="mt-6 rounded-xl border p-5">
            <h2 className="text-base font-bold">Messages</h2>
            <ul className="mt-3 mb-4 flex flex-col gap-2">
              {(messages ?? []).map((m) => (
                <li
                  key={m.id}
                  className={`max-w-[85%] rounded-lg p-3 text-sm ${
                    m.sender_id === user.id
                      ? "self-end bg-primary text-primary-foreground"
                      : "self-start bg-secondary"
                  }`}
                >
                  <p className="whitespace-pre-line break-words">{m.body}</p>
                  <p
                    className={`mt-1 text-xs ${
                      m.sender_id === user.id ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {new Date(m.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
              {(messages ?? []).length === 0 && (
                <li className="text-sm text-muted-foreground">No messages yet. Say hello!</li>
              )}
            </ul>
            <form action={sendThreadMessage} className="flex flex-col gap-2">
              <input type="hidden" name="conversation_id" value={conv.id} />
              <Textarea
                name="body"
                placeholder="Write a message"
                aria-label="Write a message"
                required
                maxLength={5000}
                rows={draft ? 5 : 2}
                defaultValue={draft?.body ?? ""}
              />
              <Button type="submit" className="self-end">Send</Button>
            </form>
            {iAmBrand && (
              <form action={draftReply} className="mt-2">
                <input type="hidden" name="conversation_id" value={conv.id} />
                <SubmitButton variant="outline" size="sm" pendingLabel="Drafting…">
                  Draft a reply with AI
                </SubmitButton>
              </form>
            )}
            {draft && (
              <p className="mt-2 text-xs text-muted-foreground">
                AI draft in your voice. Edit freely, nothing sends until you press Send.
              </p>
            )}
          </section>
        )}

        {iAmBrand && conv.status === "accepted" && !hasPendingOffer && (
          <section id="offer-section" className="mt-6 rounded-2xl bg-card p-6 shadow-card scroll-mt-20">
            <h2 className="text-base font-bold">Send an offer</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Agree on the work in chat, then put a price on it. Accepting
              starts the deal at your agreed price.
            </p>
            {(offerings ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                This creator has no active offerings to base an offer on.
              </p>
            ) : (
              <form action={sendOffer} className="mt-3 flex flex-col gap-3">
                <input type="hidden" name="conversation_id" value={conv.id} />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="offer-offering">Offering</Label>
                  <select
                    id="offer-offering"
                    name="offering_id"
                    required
                    className="h-10 rounded-lg border bg-background px-3 text-sm"
                  >
                    {(offerings ?? []).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.title} (listed ${(o.price_cents / 100).toFixed(0)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="offer-price">Agreed price (USD)</Label>
                  <Input id="offer-price" name="price" inputMode="decimal" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="offer-note">Scope note (optional, becomes the brief)</Label>
                  <Textarea
                    id="offer-note"
                    name="note"
                    rows={3}
                    maxLength={2000}
                    placeholder="What you agreed on: deliverable, angle, timing."
                  />
                </div>
                <Button type="submit" size="sm" className="self-start">Send offer</Button>
              </form>
            )}
          </section>
        )}

        {iAmBrand && (
          <form action={blockCreator} className="mt-8">
            <input type="hidden" name="creator_id" value={conv.creator_id} />
            <input type="hidden" name="back" value={`/inbox/${conv.id}`} />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive"
            >
              Block this creator
            </Button>
          </form>
        )}
      </main>
    </>
  );
}
