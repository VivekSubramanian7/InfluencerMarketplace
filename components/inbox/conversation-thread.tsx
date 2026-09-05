import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { draftReply, respondInvite, respondOffer, sendOffer } from "@/app/inbox/actions";
import { MessageComposer } from "@/components/inbox/message-composer";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { inboxCta } from "@/lib/inbox/cta";

export async function ConversationThread({
  conversationId,
  compact = false,
}: {
  conversationId: string;
  compact?: boolean;
}) {
  const { user, role } = await requireUser(`/inbox/${conversationId}`);
  const supabase = await createServerSupabase();

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, brand_id, creator_id, status, invite_message, created_at")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) notFound();
  if (conv.brand_id !== user.id && conv.creator_id !== user.id) notFound();

  const iAmBrand = conv.brand_id === user.id;
  const otherId = iAmBrand ? conv.creator_id : conv.brand_id;

  const [{ data: otherProfile }, { data: brandProfile }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", otherId).maybeSingle(),
    iAmBrand
      ? Promise.resolve({ data: null })
      : supabase.from("brand_profiles").select("company").eq("user_id", conv.brand_id).maybeSingle(),
  ]);
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

  const pendingOffer = (offers ?? []).find((o) => o.status === "pending");
  const cta = inboxCta({
    role: iAmBrand ? "brand" : "creator",
    convStatus: conv.status as "invited" | "accepted" | "declined",
    hasPendingOffer: !!pendingOffer,
    pendingOfferId: pendingOffer?.id,
  });

  const { data: draft } = iAmBrand
    ? await supabase.from("agent_drafts").select("body").eq("conversation_id", conv.id).maybeSingle()
    : { data: null };

  const { data: offerings } = iAmBrand && conv.status === "accepted"
    ? await supabase
        .from("offerings")
        .select("id, title, price_cents")
        .eq("creator_id", conv.creator_id)
        .eq("active", true)
        .order("price_cents")
    : { data: null };

  return (
    <div className={compact ? "p-4" : ""}>
      {!compact && (
        <Link href="/inbox" className="text-sm text-muted-foreground hover:text-foreground md:hidden">
          ← Inbox
        </Link>
      )}
      <h2 className={`font-semibold text-[var(--ink)] ${compact ? "text-lg" : "mt-3 text-2xl"}`}>
        {otherLabel}
      </h2>
      <Badge variant="secondary" className="mt-2">
        {conv.status === "invited" ? "Invite pending" : conv.status === "declined" ? "Declined" : "Active"}
      </Badge>

      {cta.kind === "accept_invite" && (
        <div className="mt-4 flex gap-2">
          <form action={respondInvite}>
            <input type="hidden" name="conversation_id" value={conv.id} />
            <input type="hidden" name="response" value="accepted" />
            <Button type="submit" size="sm">Accept invite</Button>
          </form>
        </div>
      )}
      {cta.kind === "wait_invite" && (
        <p className="mt-4 text-sm text-muted-foreground">Waiting for {otherLabel} to respond.</p>
      )}
      {cta.kind === "accept_offer" && pendingOffer && (
        <form action={respondOffer} className="mt-4">
          <input type="hidden" name="offer_id" value={pendingOffer.id} />
          <input type="hidden" name="conversation_id" value={conv.id} />
          <input type="hidden" name="response" value="accepted" />
          <Button type="submit" size="sm">Accept offer</Button>
        </form>
      )}
      {cta.kind === "send_offer" && (
        <a href="#offer-section" className="mt-4 inline-block text-sm font-medium underline">
          Send offer
        </a>
      )}

      {conv.status === "accepted" && (
        <section className="mt-4">
          <ul className="flex flex-col gap-2">
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
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <MessageComposer
              conversationId={conv.id}
              defaultValue={draft?.body ?? ""}
              showDraftButton={iAmBrand}
              draftAction={draftReply}
            />
          </div>
        </section>
      )}

      {iAmBrand && conv.status === "accepted" && !pendingOffer && (offerings ?? []).length > 0 && (
        <section id="offer-section" className="mt-6 border-t border-[var(--border)] pt-4">
          <h3 className="text-base font-semibold">Send an offer</h3>
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
                    {o.title} (${(o.price_cents / 100).toFixed(0)})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="offer-price">Agreed price (USD)</Label>
              <Input id="offer-price" name="price" inputMode="decimal" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="offer-note">Scope note (optional)</Label>
              <Textarea id="offer-note" name="note" rows={2} maxLength={2000} />
            </div>
            <Button type="submit" size="sm" className="self-start">Send offer</Button>
          </form>
        </section>
      )}
    </div>
  );
}
