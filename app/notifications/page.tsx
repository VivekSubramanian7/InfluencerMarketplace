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
          <p className="mt-6 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nothing yet — invites, offers, and deal updates land here.
          </p>
        ) : (
          <ul className="mt-6 flex flex-col gap-2">
            {rows.map((n) => {
              const inner = (
                <>
                  <span className="flex min-w-0 flex-col">
                    <span className={`truncate text-sm ${n.read_at ? "font-medium" : "font-bold"}`}>
                      {!n.read_at && (
                        <span aria-hidden className="mr-2 inline-block size-2 rounded-full bg-primary align-middle" />
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
                      className="flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors hover:border-primary/40"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
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
