import Link from "next/link";
import { requireUser } from "@/lib/auth/require";
import { touchCursor } from "@/lib/feature-cursors";
import { createServerSupabase } from "@/lib/supabase/server";
import { AuthenticatedShell } from "@/components/authenticated-shell";
import { ConversationList } from "@/components/inbox/conversation-list";
import { ConversationThread } from "@/components/inbox/conversation-thread";
import { isArchivedForUser } from "@/lib/inbox/archive";
import { inboxCta } from "@/lib/inbox/cta";
import { sortConversationsByActivity } from "@/lib/inbox/ordering";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; status?: string; c?: string; focus?: string }>;
}) {
  const { user, role } = await requireUser("/inbox");
  await touchCursor("inbox");
  const { error, sent, status, c: selectedId, focus } = await searchParams;
  const filter = status ?? "all";
  const supabase = await createServerSupabase();

  const { data: conversations, error: qErr } = await supabase
    .from("conversations")
    .select(
      "id, brand_id, creator_id, status, invite_message, created_at, archived_by_brand_at, archived_by_creator_at"
    )
    .or(`brand_id.eq.${user.id},creator_id.eq.${user.id}`);
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
      .select("conversation_id, price_cents, status, id")
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

  const allRows = mine.map((c) => {
    const last = lastMessageById.get(c.id);
    const archived = isArchivedForUser(c, user.id);
    const archivedAt = archived
      ? (c.brand_id === user.id ? c.archived_by_brand_at : c.archived_by_creator_at)
      : null;
    const pendingOffer = pendingOfferByConv.has(c.id);
    const cta = inboxCta({
      role: c.brand_id === user.id ? "brand" : "creator",
      convStatus: c.status as "invited" | "accepted" | "declined",
      hasPendingOffer: pendingOffer,
    });
    const waiting =
      c.status === "invited" && c.creator_id === user.id ||
      (!!last && last.sender_id !== user.id);
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
      waiting,
      cta,
      archivedAt,
      inviteMessage: c.invite_message,
      lastActivityAt: last?.created_at ?? null,
      createdAt: c.created_at,
    };
  });

  let visible = allRows;
  if (filter === "archived") {
    visible = allRows.filter((r) => r.archivedAt);
  } else {
    visible = allRows.filter((r) => !r.archivedAt);
    if (filter === "active") visible = visible.filter((r) => r.status === "accepted");
    if (filter === "invites") visible = visible.filter((r) => r.status === "invited");
  }

  const sorted = sortConversationsByActivity(visible);

  const ownedSelected =
    selectedId && mine.some((conv) => conv.id === selectedId) ? selectedId : null;

  return (
    <AuthenticatedShell
      userId={user.id}
      role={role}
      pane={
        ownedSelected ? (
          <ConversationThread
            conversationId={ownedSelected}
            compact
            returnTo={`/inbox?c=${ownedSelected}`}
            offerOpen={focus === "offer"}
          />
        ) : undefined
      }
    >
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>

        <nav className="mt-3 flex flex-wrap gap-1" aria-label="Filter conversations">
          {[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "invites", label: "Invites" },
            { value: "archived", label: "Archived" },
          ].map((f) => {
            const active = filter === f.value;
            const href = f.value === "all" ? "/inbox" : `/inbox?status=${f.value}`;
            return (
              <Link
                key={f.value}
                href={href}
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

        <ConversationList
          conversations={sorted}
          status={filter}
          totalCount={allRows.filter((r) => !r.archivedAt).length}
          role={role}
          hasFilters={status != null && status !== "all"}
        />
    </AuthenticatedShell>
  );
}
