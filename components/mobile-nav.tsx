"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardIcon,
  SearchIcon,
  MessageIcon,
  HandshakeIcon,
  HomeIcon,
  CampaignsIcon,
} from "@/components/ui/icons";

const CREATOR_TABS = [
  { href: "/dashboard", label: "Studio", icon: DashboardIcon },
  { href: "/inbox", label: "Inbox", icon: MessageIcon, key: "inbox" as const },
  { href: "/deals", label: "Deals", icon: HandshakeIcon, key: "deals" as const },
  { href: "/campaigns", label: "Campaigns", icon: CampaignsIcon, key: "campaigns" as const },
] as const;

const BRAND_TABS = [
  { href: "/brand", label: "Home", icon: HomeIcon },
  { href: "/discover", label: "Discover", icon: SearchIcon },
  { href: "/inbox", label: "Inbox", icon: MessageIcon, key: "inbox" as const },
  { href: "/deals", label: "Deals", icon: HandshakeIcon, key: "deals" as const },
] as const;

function tabActive(pathname: string, href: string) {
  const base = href.split("?")[0]!;
  if (base === "/deals") return pathname === "/deals" || pathname.startsWith("/deals/");
  return pathname === base || pathname.startsWith(base + "/");
}

export function MobileNav({
  role,
  unreadInbox = false,
  unreadDeals = false,
  unreadCampaigns = false,
}: {
  role: "creator" | "brand" | "admin";
  unreadInbox?: boolean;
  unreadDeals?: boolean;
  unreadCampaigns?: boolean;
}) {
  const pathname = usePathname();
  if (role === "admin") return null;

  const tabs = role === "creator" ? CREATOR_TABS : BRAND_TABS;
  const flagMap: Record<string, boolean> = {
    inbox: unreadInbox,
    deals: unreadDeals,
    campaigns: unreadCampaigns,
  };

  return (
    <nav
      className="mobile-nav fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-md md:hidden"
      aria-label="Mobile navigation"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {tabs.map((tab) => {
          const active = tabActive(pathname, tab.href);
          const Icon = tab.icon;
          const hasUnread = "key" in tab ? flagMap[tab.key] ?? false : false;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={`mobile-tab relative flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                  active ? "text-[var(--ink)]" : "text-[var(--muted-foreground)]"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span className="relative">
                  <Icon size={24} strokeWidth={active ? 2.5 : 1.5} aria-hidden />
                  {hasUnread && (
                    <span
                      aria-hidden
                      className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber"
                    />
                  )}
                </span>
                <span className={`text-[10px] leading-tight ${active ? "font-semibold" : "font-medium"}`}>
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
