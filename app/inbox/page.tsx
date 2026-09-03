import Link from "next/link";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { respondInvite } from "./actions";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { ConversationList } from "@/components/inbox/conversation-list";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; status?: string }>;
}) {
  const { user, role } = await requireUser("/inbox");
  const { error, sent, status } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: conversations, error: qErr } = await supabase
    .from("conversations")
    .select("id, brand_id, creator_id, status, invite_message, created_at")
    .or(`brand_id.eq.${user.id},creator_id.eq.${user.id}`)
    .order("created_at", { ascending: false });
  if (qErr) throw new Error("conversations query failed: " + qErr.message);

  const mine = conversations ?? [];
  const convIds = mine.map((c) => c.id);
  const lastMessageById = new Map<
    string,
    { body: string; sender_id: string; created_at: string }
  >();
  if (convIds.length > 0) {
    const { data: lastMsgs } = await supabase
      .from("messages")
      .select("conversation_id, body, sender_id, created_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false });
    for (const m of lastMsgs ?? []) {
      if (!lastMessageById.has(m.conversation_id!)) {
        lastMessageById.set(m.conversation_id!, m);
      }
    }
  }

  const pendingOfferByConv = new Map<string, number>();
  if (convIds.length > 0) {
    const { data: offers } = await supabase
      .from("offers")
      .select("conversation_id, price_cents, status")
      .in("conversation_id", convIds)
      .eq("status", "pending");
    for (const o of offers ?? []) {
      if (o.conversation_id && !pendingOfferByConv.has(o.conversation_id)) {
        pendingOfferByConv.set(o.conversation_id, o.price_cents);
      }
    }
  }

  const otherId = (c: { brand_id: string; creator_id: string }) =>
    c.brand_id === user.id ? c.creator_id : c.brand_id;
  const otherIds = [...new Set(mine.map(otherId))];

  const nameById = new Map<string, string | null>();
  const companyById = new Map<string, string | null>();
  if (otherIds.length > 0) {
    const [{ data: profiles }, { data: brands }] = await Promise.all([
      supabase.from("profiles").select("id, display_name").in("id", otherIds),
      supabase.from("brand_profiles").select("user_id, company").in("user_id", otherIds),
    ]);
    for (const p of profiles ?? []) nameById.set(p.id, p.display_name);
    for (const b of brands ?? []) companyById.set(b.user_id, b.company);
  }
  const label = (c: { brand_id: string; creator_id: string }) => {
    const id = otherId(c);
    return (c.brand_id === id ? companyById.get(id) : null) || nameById.get(id) || "Someone";
  };

  const pendingForMe = mine.filter((c) => c.status === "invited" && c.creator_id === user.id);
  const allRest = mine.filter((c) => !pendingForMe.includes(c));
  const rest =
    status && status !== "all" ? allRest.filter((c) => c.status === status) : allRest;

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">Inbox</h1>

        <nav className="mt-3 flex flex-wrap gap-1" aria-label="Filter conversations">
          {[
            { value: "all", label: "All" },
            { value: "accepted", label: "Active" },
            { value: "invited", label: "Pending" },
            { value: "declined", label: "Declined" },
          ].map((f) => {
            const active = (status ?? "all") === f.value;
            return (
              <Link
                key={f.value}
                href={f.value === "all" ? "/inbox" : `/inbox?status=${f.value}`}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </nav>

        {error && (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {sent && (
          <p className="mt-4 rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
            {sent === "1" ? "Invitation sent." : `${sent} invitations sent.`}
          </p>
        )}

        {pendingForMe.length > 0 && (
          <section className="mt-6">
            <h2 className="flex items-center gap-2.5 text-lg font-bold">
              <span aria-hidden className="size-2 rounded-full bg-amber" />
              Brand invitations
              <span className="text-sm font-medium text-muted-foreground tabular-nums">
                ({pendingForMe.length})
              </span>
            </h2>
            <ul className="mt-3 flex flex-col gap-3">
              {pendingForMe.map((c) => (
                <li key={c.id} className="rounded-2xl bg-card p-6 shadow-card ring-1 ring-amber/20">
                  <p className="font-bold">{label(c)}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {c.invite_message}
                  </p>
                  {pendingOfferByConv.has(c.id) && (
                    <p className="mt-2 text-sm font-medium text-primary">
                      Includes an offer · ${(pendingOfferByConv.get(c.id)! / 100).toFixed(0)}
                    </p>
                  )}
                  <div className="mt-4 flex gap-2">
                    <form action={respondInvite}>
                      <input type="hidden" name="conversation_id" value={c.id} />
                      <input type="hidden" name="response" value="accepted" />
                      <Button type="submit" size="sm">Accept &amp; chat</Button>
                    </form>
                    <form action={respondInvite}>
                      <input type="hidden" name="conversation_id" value={c.id} />
                      <input type="hidden" name="response" value="declined" />
                      <Button type="submit" variant="outline" size="sm">Decline</Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <ConversationList
          conversations={rest.map((c) => {
            const last = lastMessageById.get(c.id);
            return {
              id: c.id,
              status: c.status,
              label: label(c),
              lastMessage: last
                ? {
                    body: last.body,
                    senderIsMe: last.sender_id === user.id,
                    created_at: last.created_at,
                  }
                : null,
              waiting: !!last && last.sender_id !== user.id,
            };
          })}
          status={status ?? null}
          totalCount={allRest.length}
          role={role}
        />
      </main>
    </>
  );
}
