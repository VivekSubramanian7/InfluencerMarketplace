import Link from "next/link";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { SiteNav } from "@/components/site-nav";

export default async function NotificationsPage() {
  const { user, role } = await requireUser("/notifications");
  const supabase = await createServerSupabase();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, kind, title, body, href, created_at, read_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // opening the page marks everything read; the fetched rows above keep
  // their unread styling for this render
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  const rows = notifications ?? [];

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">Notifications</h1>
        {rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            <span aria-hidden className="empty-icon mx-auto mb-3 block text-3xl">🔔</span>
            <p className="font-semibold text-foreground">All caught up</p>
            <p className="mt-1">Invites, offers, and deal updates land here.</p>
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-2">
            {rows.map((n) => {
              const inner = (
                <>
                  <span className="flex min-w-0 flex-col">
                    <span className={`truncate text-sm ${n.read_at ? "font-medium" : "font-bold"}`}>
                      {!n.read_at && (
                        <span aria-hidden className="mr-2 inline-block size-2 rounded-full bg-amber align-middle" />
                      )}
                      {n.title}
                    </span>
                    {n.body && (
                      <span className="mt-0.5 truncate text-sm text-muted-foreground">{n.body}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {new Date(n.created_at).toLocaleDateString()}
                  </span>
                </>
              );
              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link
                      href={n.href}
                      className={`deal-row flex items-center justify-between gap-4 rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-card-hover ${
                        n.read_at ? "bg-card shadow-card" : "bg-card shadow-card ring-1 ring-amber/20"
                      }`}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className={`flex items-center justify-between gap-4 rounded-2xl p-4 ${
                      n.read_at ? "bg-card shadow-card" : "bg-card shadow-card ring-1 ring-amber/20"
                    }`}>
                      {inner}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
