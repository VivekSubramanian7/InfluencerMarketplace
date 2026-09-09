"use client";

import Link from "next/link";
import { respondInvite, unarchiveConversation } from "@/app/inbox/actions";
import type { InboxCta } from "@/lib/inbox/cta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

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

export type ConversationListItem = {
  id: string;
  status: string;
  label: string;
  lastMessage: { body: string; senderIsMe: boolean; created_at: string } | null;
  waiting: boolean;
  cta?: InboxCta;
  archivedAt: string | null;
  inviteMessage?: string | null;
};

function RowPreview({ item }: { item: ConversationListItem }) {
  if (item.lastMessage) {
    return (
      <p className="mt-0.5 truncate text-sm text-muted-foreground">
        {item.lastMessage.senderIsMe ? "You: " : ""}
        {item.lastMessage.body.slice(0, 80)}
      </p>
    );
  }
  if (item.status === "invited" && item.inviteMessage) {
    return (
      <p className="mt-0.5 truncate text-sm text-muted-foreground">
        {item.inviteMessage.slice(0, 80)}
      </p>
    );
  }
  return null;
}

function RowActions({ item }: { item: ConversationListItem }) {
  if (item.archivedAt) {
    return (
      <form action={unarchiveConversation}>
        <input type="hidden" name="conversation_id" value={item.id} />
        <Button type="submit" variant="outline" size="sm">Unarchive</Button>
      </form>
    );
  }
  if (item.cta?.kind === "accept_invite") {
    return (
      <form action={respondInvite}>
        <input type="hidden" name="conversation_id" value={item.id} />
        <input type="hidden" name="response" value="accepted" />
        <SubmitButton size="sm" pendingLabel="Accepting…">Accept</SubmitButton>
      </form>
    );
  }
  return null;
}

function RowLink({
  item,
  href,
  className,
}: {
  item: ConversationListItem;
  href: string;
  className: string;
}) {
  const timestamp = item.lastMessage?.created_at ?? item.archivedAt;
  return (
    <Link href={href} className={className}>
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--ground)] text-xs font-semibold text-[var(--ink)]"
      >
        {item.label.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {item.waiting && (
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-amber" />
          )}
          <span className={`truncate ${item.waiting ? "font-semibold" : "font-medium"}`}>
            {item.label}
          </span>
        </span>
        <RowPreview item={item} />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge variant="secondary">{STATUS_LABELS[item.status] ?? item.status}</Badge>
        {timestamp && (
          <span className="text-xs text-muted-foreground">{timeAgo(timestamp)}</span>
        )}
      </div>
    </Link>
  );
}

export function ConversationRow({
  item,
  selected,
  onToggle,
}: {
  item: ConversationListItem;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const rowClass =
    "flex min-w-0 flex-1 items-center gap-3 px-2 py-3 transition-colors hover:bg-[var(--row-hover)]";

  return (
    <li className="flex items-center gap-2">
      {!item.archivedAt && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(item.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${item.label}`}
          className="ml-1 size-4 shrink-0 accent-primary"
        />
      )}
      <RowLink item={item} href={`/inbox?c=${item.id}`} className={`hidden ${rowClass} md:flex`} />
      <RowLink item={item} href={`/inbox/${item.id}`} className={`flex ${rowClass} md:hidden`} />
      <div className="hidden shrink-0 md:block">
        <RowActions item={item} />
      </div>
      <div className="shrink-0 md:hidden">
        <RowActions item={item} />
      </div>
    </li>
  );
}
