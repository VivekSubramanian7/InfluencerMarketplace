"use client";

import Link from "next/link";
import { markAllRead, markRead } from "@/app/notifications/actions";
import { Button } from "@/components/ui/button";

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.floor((today.getTime() - target.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export interface NotificationRow {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  created_at: string;
  read_at: string | null;
}

function quickActionLabel(kind: string): string | null {
  switch (kind) {
    case "offer": return "View offer";
    case "booking": case "deal": return "View deal";
    case "application_response": return "Open deal";
    case "invite": return "View invite";
    default: return null;
  }
}

export function NotificationList({
  notifications,
  hasUnread,
}: {
  notifications: NotificationRow[];
  hasUnread: boolean;
}) {
  const grouped = new Map<string, NotificationRow[]>();
  for (const n of notifications) {
    const key = dayLabel(n.created_at);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(n);
  }

  return (
    <>
      {hasUnread && (
        <form action={markAllRead} className="mt-4 flex justify-end">
          <Button type="submit" variant="outline" size="sm">
            Mark all read
          </Button>
        </form>
      )}
      <div className="mt-4 flex flex-col gap-6">
        {[...grouped.entries()].map(([day, items]) => (
          <section key={day}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {day}
            </h2>
            <ul className="flex flex-col gap-2">
              {items.map((n) => (
                <li key={n.id} className="group relative">
                  {n.href ? (
                    <Link
                      href={n.href}
                      className={`deal-row flex items-center justify-between gap-4 rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-card-hover ${
                        n.read_at ? "bg-card shadow-card" : "bg-card shadow-card ring-1 ring-amber/20"
                      }`}
                    >
                      <NotificationInner n={n} />
                    </Link>
                  ) : (
                    <div
                      className={`flex items-center justify-between gap-4 rounded-2xl p-4 ${
                        n.read_at ? "bg-card shadow-card" : "bg-card shadow-card ring-1 ring-amber/20"
                      }`}
                    >
                      <NotificationInner n={n} />
                    </div>
                  )}
                  {!n.read_at && (
                    <form
                      action={markRead}
                      className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100"
                    >
                      <input type="hidden" name="id" value={n.id} />
                      <button
                        type="submit"
                        className="rounded-full p-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                        aria-label="Mark as read"
                        title="Mark as read"
                      >
                        ✓
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function NotificationInner({ n }: { n: NotificationRow }) {
  const actionLabel = quickActionLabel(n.kind);
  return (
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
      <span className="flex shrink-0 items-center gap-2">
        {actionLabel && n.href && (
          <span className="hidden rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex">
            {actionLabel}
          </span>
        )}
        <span className="text-xs text-muted-foreground tabular-nums">
          {timeAgo(n.created_at)}
        </span>
      </span>
    </>
  );
}
