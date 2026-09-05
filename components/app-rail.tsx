"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/(auth)/actions";
import {
  DashboardIcon,
  SearchIcon,
  MessageIcon,
  HandshakeIcon,
  HomeIcon,
  CampaignsIcon,
  BellIcon,
  LogOutIcon,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>;
  badge?: number;
};

export type AppRailProps = {
  role: "creator" | "brand" | "admin";
  userId: string;
  unreadInbox: number;
  unreadNotifications: number;
  displayName: string | null;
  email: string;
  workspaceName: string;
  workspaceRole: "creator" | "brand" | "admin";
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppRail({
  role,
  unreadInbox,
  unreadNotifications,
  displayName,
  email,
  workspaceName,
  workspaceRole,
}: AppRailProps) {
  const pathname = usePathname();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const core: NavItem[] = [
    { href: "/inbox", label: "Inbox", icon: MessageIcon, badge: unreadInbox },
    { href: "/deals", label: "Deals", icon: HandshakeIcon },
    { href: "/campaigns", label: "Campaigns", icon: CampaignsIcon },
  ];

  const business: NavItem[] =
    role === "creator"
      ? [
          { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
          ...(displayName
            ? []
            : []),
        ]
      : role === "admin"
        ? [{ href: "/admin", label: "Admin", icon: DashboardIcon }]
        : [
            { href: "/discover", label: "Discover", icon: SearchIcon },
            { href: "/brand", label: "Brand home", icon: HomeIcon },
          ];

  const utility: NavItem[] = [
    { href: "/notifications", label: "Notifications", icon: BellIcon, badge: unreadNotifications },
    {
      href: role === "brand" ? "/brand/settings" : "/dashboard?tab=profile",
      label: "Settings",
      icon: DashboardIcon,
    },
  ];

  const roleChipClass =
    workspaceRole === "creator"
      ? "bg-[var(--role-creator)] text-[var(--role-creator-foreground)]"
      : workspaceRole === "brand"
        ? "bg-[var(--role-brand)] text-[var(--role-brand-foreground)]"
        : "bg-secondary text-foreground";

  const initial = (workspaceName || displayName || email || "?").charAt(0).toUpperCase();

  const renderItem = (item: NavItem) => {
    const active = isActive(pathname, item.href.split("?")[0]!);
    const Icon = item.icon;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={`flex items-center gap-2.5 rounded-full px-3 py-2 text-[13px] font-medium transition-colors ${
            active
              ? "border border-[var(--border)] bg-[var(--card)] text-[var(--ink)]"
              : "text-[var(--muted-foreground)] hover:bg-[var(--row-hover)] hover:text-[var(--ink)]"
          }`}
        >
          <Icon size={16} strokeWidth={active ? 2 : 1.5} aria-hidden />
          <span className="flex-1">{item.label}</span>
          {item.badge != null && item.badge > 0 && (
            <span className="grid min-w-5 place-items-center rounded-full bg-[var(--ink)] px-1.5 text-[11px] font-medium tabular-nums text-[var(--primary-foreground)]">
              {item.badge > 9 ? "9+" : item.badge}
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <aside className="flex h-dvh w-[220px] shrink-0 flex-col bg-[var(--rail)] p-3">
      <button
        type="button"
        onClick={() => setDetailsOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--row-hover)]"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--card)] border border-[var(--border)] text-sm font-semibold text-[var(--ink)]">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-[var(--ink)]">{workspaceName}</span>
          <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${roleChipClass}`}>
            {workspaceRole === "creator" ? "Creator" : workspaceRole === "brand" ? "Brand" : "Admin"}
          </span>
        </span>
      </button>
      {detailsOpen && (
        <div className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm">
          {email && <p className="truncate text-[var(--muted-foreground)]">{email}</p>}
          <form action={logout} className="mt-2">
            <Button type="submit" variant="ghost" size="sm" className="h-8 px-2 text-[var(--muted-foreground)]">
              <LogOutIcon size={14} aria-hidden />
              Log out
            </Button>
          </form>
        </div>
      )}

      <div className="mt-3">
        <details className="group">
          <summary className="flex w-full cursor-pointer items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:opacity-90 [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="text-base leading-none">+</span>
            <span className="flex-1">New…</span>
            <span aria-hidden className="text-xs transition-transform group-open:rotate-180">▾</span>
          </summary>
          <ul className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-[var(--shadow-float)]">
            {role === "creator" ? (
              <>
                <li>
                  <Link href="/dashboard?tab=offerings&new=1" className="block rounded-md px-3 py-2 text-sm transition-colors hover:bg-[var(--row-hover)]">
                    New offering
                  </Link>
                </li>
                <li>
                  <Link href="/inbox" className="block rounded-md px-3 py-2 text-sm transition-colors hover:bg-[var(--row-hover)]">
                    Start conversation
                  </Link>
                </li>
              </>
            ) : role === "brand" ? (
              <>
                <li>
                  <Link href="/campaigns?new=1" className="block rounded-md px-3 py-2 text-sm transition-colors hover:bg-[var(--row-hover)]">
                    New campaign
                  </Link>
                </li>
                <li>
                  <Link href="/discover" className="block rounded-md px-3 py-2 text-sm transition-colors hover:bg-[var(--row-hover)]">
                    Find creators
                  </Link>
                </li>
              </>
            ) : null}
          </ul>
        </details>
      </div>

      <nav className="mt-4 flex flex-1 flex-col" aria-label="Main">
        <ul className="flex flex-col gap-0.5">{core.map(renderItem)}</ul>
        <div className="my-3 h-px bg-[var(--divider)]" />
        <ul className="flex flex-col gap-0.5">{business.map(renderItem)}</ul>
        <div className="mt-auto pt-4">
          <ul className="flex flex-col gap-0.5">{utility.map(renderItem)}</ul>
        </div>
      </nav>
    </aside>
  );
}
