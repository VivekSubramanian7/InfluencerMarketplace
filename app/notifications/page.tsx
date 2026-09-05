import Link from "next/link";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { AuthenticatedShell } from "@/components/authenticated-shell";
import { BellIcon } from "@/components/ui/icons";
import { NotificationList } from "@/components/notifications/notification-list";

const CATEGORY_KINDS: Record<string, string[]> = {
  messages: ["message", "stale_thread", "agent_digest"],
  offers: ["offer", "offer_response"],
  deals: ["deal", "booking"],
  campaigns: ["application", "application_response", "invite", "invite_response"],
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { user, role } = await requireUser("/notifications");
  const { category } = await searchParams;
  const supabase = await createServerSupabase();

  const base = supabase
    .from("notifications")
    .select("id, kind, title, body, href, created_at, read_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const kinds = category ? CATEGORY_KINDS[category] : null;
  const listQuery = kinds ? base.in("kind", kinds) : base;

  const countQuery = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  const [{ data: notifications }, { count: unreadCount }] = await Promise.all([
    listQuery,
    countQuery,
  ]);

  const rows = notifications ?? [];

  return (
    <AuthenticatedShell userId={user.id} role={role}>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>

        <nav className="mt-3 flex flex-wrap gap-1" aria-label="Filter notifications">
          {[
            { value: "all", label: "All" },
            { value: "messages", label: "Messages" },
            { value: "offers", label: "Offers" },
            { value: "deals", label: "Deals" },
            { value: "campaigns", label: "Campaigns" },
          ].map((f) => {
            const active = (category ?? "all") === f.value;
            return (
              <Link
                key={f.value}
                href={f.value === "all" ? "/notifications" : `/notifications?category=${f.value}`}
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

        {rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            <span aria-hidden className="mx-auto mb-3 block w-fit text-muted-foreground/40">
              <BellIcon size={36} />
            </span>
            <p className="font-semibold text-foreground">All caught up</p>
            <p className="mt-1">Invites, offers, and deal updates land here.</p>
          </div>
        ) : (
          <NotificationList
            notifications={rows}
            hasUnread={(unreadCount ?? 0) > 0}
            activeKinds={kinds ?? undefined}
          />
        )}
    </AuthenticatedShell>
  );
}
