import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { createServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/mobile-nav";

export async function SiteNav({ role }: { role: "creator" | "brand" | "admin" }) {
  const links =
    role === "creator"
      ? [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/campaigns", label: "Campaigns" },
          { href: "/inbox", label: "Inbox" },
          { href: "/deals", label: "Deals" },
        ]
      : role === "admin"
        ? [
            { href: "/admin", label: "Admin" },
            { href: "/deals", label: "Deals" },
          ]
        : [
            { href: "/brand", label: "Brand home" },
            { href: "/discover", label: "Discover" },
            { href: "/campaigns", label: "Campaigns" },
            { href: "/inbox", label: "Inbox" },
            { href: "/deals", label: "Deals" },
          ];

  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  let unread = 0;
  if (sub) {
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", sub)
      .is("read_at", null);
    unread = count ?? 0;
  }

  return (
    <>
      <nav className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2.5">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-lg font-black tracking-tight">
              Clipline
            </Link>
            <div className="hidden items-center gap-0.5 rounded-full bg-secondary/60 p-1 md:flex">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground hover:shadow-sm"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/notifications"
              aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
              className="relative hidden size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:grid"
            >
              <Bell className="size-4.5" aria-hidden />
              {unread > 0 && (
                <span
                  aria-hidden
                  className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground tabular-nums"
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <form action={logout}>
              <Button variant="ghost" size="icon-sm" className="rounded-full text-muted-foreground">
                <LogOut className="size-4" aria-hidden />
                <span className="sr-only">Log out</span>
              </Button>
            </form>
          </div>
        </div>
      </nav>
      <MobileNav role={role} unread={unread} />
    </>
  );
}
