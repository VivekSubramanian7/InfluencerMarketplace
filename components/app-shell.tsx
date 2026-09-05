import type { ReactNode } from "react";
import { AppRail, type AppRailProps } from "@/components/app-rail";
import { MobileNav } from "@/components/mobile-nav";

export function AppShell({
  children,
  pane,
  ...railProps
}: {
  children: ReactNode;
  pane?: ReactNode;
} & AppRailProps) {
  return (
    <div className="flex h-dvh bg-[var(--ground)]">
      <div className="hidden md:block">
        <AppRail {...railProps} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-2 md:p-3">
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--card)]">
          <div className="min-w-0 flex-1 overflow-y-auto p-6 pb-24 md:pb-6">
            {children}
          </div>
          {pane ? (
            <aside className="hidden w-[min(42%,28rem)] shrink-0 overflow-y-auto border-l border-[var(--border)] lg:block">
              {pane}
            </aside>
          ) : null}
        </div>
      </div>
      <MobileNav
        role={railProps.role}
        unread={railProps.unreadNotifications}
        inboxUnread={railProps.unreadInbox}
      />
    </div>
  );
}
