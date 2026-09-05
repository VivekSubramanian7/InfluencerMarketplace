"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const STATUS_LABELS: Record<string, string> = {
  invited: "Invite pending",
  accepted: "Active",
  declined: "Declined",
};

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export interface ConversationRow {
  id: string;
  status: string;
  label: string;
  lastMessage: { body: string; senderIsMe: boolean; created_at: string } | null;
  waiting: boolean;
}

export function ConversationList({
  conversations,
  status,
  totalCount,
  role,
}: {
  conversations: ConversationRow[];
  status: string | null;
  totalCount: number;
  role: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = search
    ? conversations.filter((c) => c.label.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">
        Conversations
        <span className="ml-2 text-sm font-medium text-muted-foreground tabular-nums">
          ({filtered.length}{status && status !== "all" ? ` of ${totalCount}` : ""})
        </span>
      </h2>
      <Input
        type="search"
        placeholder="Search by name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-3"
        aria-label="Search conversations"
      />
      {filtered.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {search ? (
            <p>No conversations match your search.</p>
          ) : role === "brand" ? (
            <>
              <p className="font-semibold text-foreground">No conversations yet</p>
              <p className="mt-1">
                Reach out to creators from{" "}
                <Link href="/discover" className="font-medium underline underline-offset-2">
                  Discover
                </Link>
                .
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-foreground">No conversations yet</p>
              <p className="mt-1">Brands you accept will appear here.</p>
            </>
          )}
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link
                href={`/inbox?c=${c.id}`}
                className="hidden items-center gap-4 rounded-lg border border-transparent p-4 transition-colors hover:bg-[var(--row-hover)] md:flex"
              >
                <div className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    {c.waiting && (
                      <span aria-hidden className="size-2 shrink-0 rounded-full bg-amber" />
                    )}
                    <span className={`truncate ${c.waiting ? "font-bold" : "font-medium"}`}>
                      {c.label}
                    </span>
                  </span>
                  {c.lastMessage && (
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {c.lastMessage.senderIsMe ? "You: " : ""}
                      {c.lastMessage.body.slice(0, 80)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant="secondary">{STATUS_LABELS[c.status] ?? c.status}</Badge>
                  {c.lastMessage && (
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(c.lastMessage.created_at)}
                    </span>
                  )}
                </div>
              </Link>
              <Link
                href={`/inbox/${c.id}`}
                className="flex items-center gap-4 rounded-lg border border-transparent p-4 transition-colors hover:bg-[var(--row-hover)] md:hidden"
              >
                <div className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    {c.waiting && (
                      <span aria-hidden className="size-2 shrink-0 rounded-full bg-amber" />
                    )}
                    <span className={`truncate ${c.waiting ? "font-semibold" : "font-medium"}`}>
                      {c.label}
                    </span>
                  </span>
                  {c.lastMessage && (
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {c.lastMessage.senderIsMe ? "You: " : ""}
                      {c.lastMessage.body.slice(0, 80)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant="secondary">{STATUS_LABELS[c.status] ?? c.status}</Badge>
                  {c.lastMessage && (
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(c.lastMessage.created_at)}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
