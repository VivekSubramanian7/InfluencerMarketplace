"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  MessageSquare,
  Handshake,
  Megaphone,
  Home,
  Bell,
  Plus,
} from "lucide-react";

const CREATOR_TABS = [
  { href: "/dashboard", label: "Studio", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/dashboard/offerings/new", label: "New", icon: Plus, central: true },
  { href: "/deals", label: "Deals", icon: Handshake },
  { href: "/notifications", label: "Alerts", icon: Bell },
] as const;

const BRAND_TABS = [
  { href: "/brand", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Search },
  { href: "/campaigns/new", label: "New", icon: Plus, central: true },
  { href: "/deals", label: "Deals", icon: Handshake },
  { href: "/notifications", label: "Alerts", icon: Bell },
] as const;

export function MobileNav({
  role,
  unread = 0,
}: {
  role: "creator" | "brand" | "admin";
  unread?: number;
}) {
  const pathname = usePathname();
  if (role === "admin") return null;

  const tabs = role === "creator" ? CREATOR_TABS : BRAND_TABS;

  return (
    <nav
      className="mobile-nav fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur-md md:hidden"
      aria-label="Mobile navigation"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {tabs.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          const Icon = tab.icon;
          const isCentral = "central" in tab && tab.central;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={
                  isCentral
                    ? "mobile-tab relative flex flex-col items-center justify-center gap-0.5 py-2"
                    : `mobile-tab relative flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                        active
                          ? "text-primary"
                          : "text-muted-foreground/70 active:text-primary"
                      }`
                }
                aria-current={active ? "page" : undefined}
              >
                {isCentral ? (
                  <span className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform active:scale-95">
                    <Icon className="size-5 stroke-[2.5]" aria-hidden />
                  </span>
                ) : (
                  <>
                    <span className="relative">
                      <Icon
                        className={`size-6 transition-all ${
                          active ? "stroke-[2.5]" : "stroke-[1.5]"
                        }`}
                        aria-hidden
                      />
                      {tab.label === "Alerts" && unread > 0 && (
                        <span
                          aria-hidden
                          className="absolute -right-1.5 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold leading-4 text-primary-foreground tabular-nums"
                        >
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </span>
                    <span
                      className={`text-[10px] leading-tight ${
                        active ? "font-bold" : "font-medium"
                      }`}
                    >
                      {tab.label}
                    </span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
