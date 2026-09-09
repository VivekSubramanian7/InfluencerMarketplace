"use client";

import { useState } from "react";
import Link from "next/link";
import { bulkArchiveConversations } from "@/app/inbox/actions";
import { ConversationRow, type ConversationListItem } from "@/components/inbox/conversation-row";
import { toggleSelection } from "@/components/inbox/selection";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export type { ConversationListItem };

export function ConversationList({
  conversations,
  status,
  totalCount,
  role,
  hasFilters = false,
}: {
  conversations: ConversationListItem[];
  status: string | null;
  totalCount: number;
  role: string;
  hasFilters?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filtered = search
    ? conversations.filter((c) => c.label.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  const filterLabel = status && status !== "all" ? ` of ${totalCount}` : "";

  return (
    <section className="mt-8">
      {selectedIds.size > 0 && status !== "archived" && (
        <form
          action={bulkArchiveConversations}
          className="sticky top-0 z-10 mb-3 flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2"
        >
          {[...selectedIds].map((id) => (
            <input key={id} type="hidden" name="conversation_id" value={id} />
          ))}
          <span className="text-sm font-medium tabular-nums">{selectedIds.size} selected</span>
          <SubmitButton size="sm" pendingLabel="Archiving…">Archive selected</SubmitButton>
        </form>
      )}

      <h2 className="text-lg font-bold">
        Conversations
        <span className="ml-2 text-sm font-medium text-muted-foreground tabular-nums">
          ({filtered.length}{filterLabel})
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
        <div className="mt-3 rounded-[var(--radius-tile)] border border-[var(--border)] p-8 text-center">
          {search ? (
            <p className="text-sm text-[var(--muted)]">No conversations match &ldquo;{search}&rdquo;.</p>
          ) : hasFilters ? (
            <>
              <p className="text-sm text-[var(--muted)]">No conversations match your filters.</p>
              <Link href="/inbox" className="mt-2 inline-block text-sm font-medium underline underline-offset-2">
                Reset filters
              </Link>
            </>
          ) : role === "brand" ? (
            <>
              <p className="font-medium text-[var(--ink)]">No conversations yet</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Reach out to creators from{" "}
                <Link href="/discover" className="font-medium underline underline-offset-2">Discover</Link>.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-[var(--ink)]">No conversations yet</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Brands you accept will appear here.</p>
            </>
          )}
        </div>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-[var(--divider)]">
          {filtered.map((c) => (
            <ConversationRow
              key={c.id}
              item={c}
              selected={selectedIds.has(c.id)}
              onToggle={(id) => setSelectedIds((prev) => toggleSelection(prev, id))}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
