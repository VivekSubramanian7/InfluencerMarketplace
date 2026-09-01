import Link from "next/link";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { respondInvite } from "./actions";
import { SiteNav } from "@/components/site-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_LABELS: Record<string, string> = {
  invited: "Invite pending",
  accepted: "Active",
  declined: "Declined",
};

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { user, role } = await requireUser("/inbox");
  const { error, sent } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: conversations, error: qErr } = await supabase
    .from("conversations")
    .select("id, brand_id, creator_id, status, invite_message, created_at")
    .or(`brand_id.eq.${user.id},creator_id.eq.${user.id}`)
    .order("created_at", { ascending: false });
  if (qErr) throw new Error("conversations query failed: " + qErr.message);

  const mine = conversations ?? [];
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
  const rest = mine.filter((c) => !pendingForMe.includes(c));

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">Inbox</h1>

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
            <h2 className="text-lg font-bold">Brand invitations</h2>
            <ul className="mt-3 flex flex-col gap-3">
              {pendingForMe.map((c) => (
                <li key={c.id} className="rounded-xl border p-5">
                  <p className="font-bold">{label(c)}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{c.invite_message}</p>
                  <div className="mt-3 flex gap-2">
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

        <section className="mt-8">
          <h2 className="text-lg font-bold">Conversations</h2>
          {rest.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {role === "brand" ? (
                <>
                  No conversations yet — reach out to creators from{" "}
                  <Link href="/discover" className="font-medium underline underline-offset-2">
                    Discover
                  </Link>
                  .
                </>
              ) : (
                "No conversations yet — brands you accept will appear here."
              )}
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {rest.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/inbox/${c.id}`}
                    className="flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors hover:border-primary/40"
                  >
                    <span className="min-w-0 truncate font-medium">{label(c)}</span>
                    <Badge variant="secondary">{STATUS_LABELS[c.status] ?? c.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
