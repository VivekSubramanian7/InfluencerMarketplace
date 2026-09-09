# WS1 — Inbox Listicle, Pinned Composer & Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the inbox per the 2026-09-07 call: conversation list becomes a dense listicle with a left checkbox for multi-select, the default view shows everyone (no pre-applied filter), the thread scrolls while the composer stays pinned at the bottom, the "send offer" panel is a collapsible always-available bar, newest messages surface at the top of the list ordering, and archive becomes a real working feature.

**Architecture:** The inbox already uses row-style links (`components/inbox/conversation-list.tsx`) and one conversation per brand↔creator pair (schema `unique (brand_id, creator_id)` — already DONE). We (1) extract a `ConversationRow` list-item with a checkbox + bulk action bar, (2) fold pending invites into the single list instead of a separate card section and default the filter to "all", (3) restructure `ConversationThread` into a flex column where messages scroll and a pinned footer holds the composer + a collapsible `<details>` send-offer panel, (4) order the conversation list by latest activity, and (5) add an `archived_at` column + archive/unarchive server actions and a working Archived tab.

**Tech Stack:** Next.js 16.3.1 (App Router, Server Components/Actions), React 19, Supabase (Postgres + RLS), Tailwind v4, Vitest.

**Source audit:** verification round 2026-09-09. Depends on WS5 only for shared `SubmitButton` usage (not blocking).

## Global Constraints

- **Next migration number:** `0028` (last existing is `0027`). If executed after another plan that consumes `0028`, use the next free number and keep the same file contents.
- **DESIGN.md App register:** dense rows not cards; hairline dividers; 8px inputs/buttons; `rounded-full` only for status chips/avatars/active nav; no `shadow-card`/`font-black` behind auth; type ≤24px/600.
- **Conversation uniqueness is already enforced** — do NOT add a new conversation-per-deal path.
- **RLS:** any new column/action must respect existing conversation RLS (`0017_conversations.sql`). Archive is per-participant.
- Run `pnpm test` and `pnpm build` before every commit; both must pass.

---

## File Structure

- `supabase/migrations/0028_conversation_archive.sql` — `archived_by_brand_at` / `archived_by_creator_at` columns + `set_conversation_archived` RPC + grants.
- `app/inbox/actions.ts` — add `archiveConversation` / `unarchiveConversation` / `bulkArchiveConversations` server actions.
- `app/inbox/page.tsx` — default filter = all; fold invites into the list; order by last activity; pass archive state; wire Archived tab to a real query.
- `components/inbox/conversation-list.tsx` — checkbox multi-select, bulk action bar, single list including invites.
- `components/inbox/conversation-row.tsx` — new extracted list-item (checkbox + identity + preview + status chip + next action).
- `components/inbox/conversation-thread.tsx` — flex column: scrollable messages + pinned footer (composer + collapsible offer panel).
- `components/inbox/send-offer-panel.tsx` — new client `<details>` collapsible wrapper for the offer form.
- `lib/inbox/ordering.ts` — pure `sortConversationsByActivity()` helper + tests.

---

## Task 1: Order conversations by latest activity (newest on top)

**Files:**
- Create: `lib/inbox/ordering.ts`
- Test: `lib/inbox/__tests__/ordering.test.ts`
- Modify: `app/inbox/page.tsx:22-26,171-187` (apply ordering to the row list)

**Interfaces:**
- Produces: `sortConversationsByActivity<T extends { lastActivityAt: string | null; createdAt: string }>(rows: T[]): T[]` — descending by `lastActivityAt ?? createdAt`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/inbox/__tests__/ordering.test.ts
import { describe, it, expect } from "vitest";
import { sortConversationsByActivity } from "../ordering";

describe("sortConversationsByActivity", () => {
  it("orders by lastActivityAt desc, falling back to createdAt", () => {
    const rows = [
      { id: "a", lastActivityAt: "2026-01-01T00:00:00Z", createdAt: "2025-01-01T00:00:00Z" },
      { id: "b", lastActivityAt: null, createdAt: "2026-02-01T00:00:00Z" },
      { id: "c", lastActivityAt: "2026-03-01T00:00:00Z", createdAt: "2020-01-01T00:00:00Z" },
    ];
    expect(sortConversationsByActivity(rows).map((r) => r.id)).toEqual(["c", "b", "a"]);
  });
});
```

- [ ] **Step 2: Run test** — `pnpm test ordering` → FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/inbox/ordering.ts
export function sortConversationsByActivity<
  T extends { lastActivityAt: string | null; createdAt: string }
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ka = a.lastActivityAt ?? a.createdAt;
    const kb = b.lastActivityAt ?? b.createdAt;
    return kb.localeCompare(ka);
  });
}
```

- [ ] **Step 4: Run test** — `pnpm test ordering` → PASS.

- [ ] **Step 5: Wire into `app/inbox/page.tsx`** — after building each row's `lastMessage`, compute `lastActivityAt = last?.created_at ?? null` and sort the array with `sortConversationsByActivity` before passing to `ConversationList` (replace the current `created_at desc` reliance).

- [ ] **Step 6: Build + commit**

```bash
git add lib/inbox/ordering.ts lib/inbox/__tests__/ordering.test.ts app/inbox/page.tsx
git commit -m "feat(inbox): order conversations by latest activity"
```

---

## Task 2: Default the inbox to show everyone (fold invites into one list)

**Files:**
- Modify: `app/inbox/page.tsx:81-118,132-191`
- Reference: current split at L81-86 (`pendingForMe` removed from list) and filter nav at L99-118.

**Interfaces:**
- Produces: a single list containing active + invited conversations by default; the filter nav becomes `All | Active | Invites | Archived` with **All** as the default (no `?status=` → all non-archived).

- [ ] **Step 1: Read** `app/inbox/page.tsx:81-191` to confirm current sectioning.

- [ ] **Step 2: Implement**
  - Remove the separate `pendingForMe` card section (L132-167). Include invited conversations in the main `rest` list.
  - Change the filter nav to four values: `all` (default), `active`, `invites`, `archived`. `status ?? "all"` selects the active pill.
  - Filtering: `all` → non-archived; `active` → `status === "accepted"`; `invites` → `status === "invited"`; `archived` → archived rows (Task 4).
  - `hasFilters` becomes `status != null && status !== "all"`.
  - Pass each row a `waiting`/`cta` hint so invited rows still show an "Accept" affordance inline (reuse `lib/inbox/cta.ts`).

- [ ] **Step 3: Manual verification** — first visit to `/inbox` shows all conversations (active + invites) with no pre-filter; switching pills filters correctly.

- [ ] **Step 4: Build + commit**

```bash
git add app/inbox/page.tsx
git commit -m "feat(inbox): default to All conversations; fold invites into one list"
```

---

## Task 3: Listicle rows with checkbox multi-select + bulk bar

**Files:**
- Create: `components/inbox/conversation-row.tsx`
- Modify: `components/inbox/conversation-list.tsx:26-135`
- Test: `components/inbox/__tests__/conversation-list-selection.test.tsx`

**Interfaces:**
- Consumes: `ConversationRow` data shape extended with `cta?: InboxCta`, `archivedAt: string | null`.
- Produces: `ConversationList` (client) manages `selectedIds: Set<string>`; renders a sticky bulk bar with "Archive selected" (calls `bulkArchiveConversations`) when `selectedIds.size > 0`; each row is a `<ConversationRow>` with a left `<input type="checkbox">` that toggles selection without navigating.

- [ ] **Step 1: Write a failing test** (selection toggling is client state; test the pure selection reducer).

```tsx
// components/inbox/__tests__/conversation-list-selection.test.tsx
import { describe, it, expect } from "vitest";
import { toggleSelection } from "../selection";

describe("toggleSelection", () => {
  it("adds and removes ids", () => {
    let s = new Set<string>();
    s = toggleSelection(s, "a");
    expect([...s]).toEqual(["a"]);
    s = toggleSelection(s, "a");
    expect([...s]).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test** — `pnpm test conversation-list-selection` → FAIL.

- [ ] **Step 3: Implement selection helper**

```ts
// components/inbox/selection.ts
export function toggleSelection(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  next.has(id) ? next.delete(id) : next.add(id);
  return next;
}
```

- [ ] **Step 4: Run test** — `pnpm test conversation-list-selection` → PASS.

- [ ] **Step 5: Extract `ConversationRow`** — a dense `flex items-center gap-3 px-2 py-3 hover:bg-[var(--row-hover)]` row: `[checkbox] [avatar] [label + last message] [status chip] [timestamp / next action]`. The checkbox is outside the `<Link>` (stops propagation); the rest of the row links to `/inbox?c=${id}` (desktop) / `/inbox/${id}` (mobile), preserving the existing dual-link pattern.

- [ ] **Step 6: Update `ConversationList`** to hold `selectedIds` state via `toggleSelection`, render `ConversationRow`s, and show a sticky bulk-action bar with a form posting selected ids to `bulkArchiveConversations` (Task 4).

- [ ] **Step 7: Build + commit**

```bash
git add components/inbox/conversation-row.tsx components/inbox/conversation-list.tsx components/inbox/selection.ts components/inbox/__tests__/conversation-list-selection.test.tsx
git commit -m "feat(inbox): listicle rows with checkbox multi-select and bulk bar"
```

---

## Task 4: Archive — schema, actions, working tab

**Files:**
- Create: `supabase/migrations/0028_conversation_archive.sql`
- Modify: `app/inbox/actions.ts` (add archive actions)
- Modify: `app/inbox/page.tsx` (Archived tab query + per-participant archive state)
- Test: `lib/inbox/__tests__/archive-visibility.test.ts`

**Interfaces:**
- Produces:
  - SQL: `alter table conversations add column archived_by_brand_at timestamptz, add column archived_by_creator_at timestamptz;` plus `set_conversation_archived(p_conversation_id uuid, p_archived boolean) returns conversations` (security definer, sets the column for the calling participant's role).
  - TS: `archiveConversation(formData)`, `unarchiveConversation(formData)`, `bulkArchiveConversations(formData)` — each calls the RPC per id; `isArchivedForUser(conv, userId): boolean`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0028_conversation_archive.sql
alter table public.conversations
  add column if not exists archived_by_brand_at timestamptz,
  add column if not exists archived_by_creator_at timestamptz;

create or replace function public.set_conversation_archived(
  p_conversation_id uuid,
  p_archived boolean
) returns public.conversations
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_conv public.conversations;
  v_ts timestamptz := case when p_archived then now() else null end;
begin
  select * into v_conv from public.conversations c where c.id = p_conversation_id;
  if not found then raise exception 'conversation not found'; end if;
  if v_conv.brand_id = v_uid then
    update public.conversations set archived_by_brand_at = v_ts where id = p_conversation_id returning * into v_conv;
  elsif v_conv.creator_id = v_uid then
    update public.conversations set archived_by_creator_at = v_ts where id = p_conversation_id returning * into v_conv;
  else
    raise exception 'not a participant';
  end if;
  return v_conv;
end;
$$;

grant execute on function public.set_conversation_archived(uuid, boolean) to authenticated;
```

- [ ] **Step 2: Write the failing visibility test**

```ts
// lib/inbox/__tests__/archive-visibility.test.ts
import { describe, it, expect } from "vitest";
import { isArchivedForUser } from "../archive";

describe("isArchivedForUser", () => {
  const base = { brand_id: "b", creator_id: "c", archived_by_brand_at: null, archived_by_creator_at: null };
  it("is archived for the brand when brand timestamp set", () => {
    expect(isArchivedForUser({ ...base, archived_by_brand_at: "2026-01-01" }, "b")).toBe(true);
    expect(isArchivedForUser({ ...base, archived_by_brand_at: "2026-01-01" }, "c")).toBe(false);
  });
});
```

- [ ] **Step 3: Run test** — `pnpm test archive-visibility` → FAIL.

- [ ] **Step 4: Implement helper**

```ts
// lib/inbox/archive.ts
type ArchiveRow = { brand_id: string; creator_id: string; archived_by_brand_at: string | null; archived_by_creator_at: string | null };
export function isArchivedForUser(c: ArchiveRow, userId: string): boolean {
  if (c.brand_id === userId) return !!c.archived_by_brand_at;
  if (c.creator_id === userId) return !!c.archived_by_creator_at;
  return false;
}
```

- [ ] **Step 5: Run test** — `pnpm test archive-visibility` → PASS.

- [ ] **Step 6: Add server actions** in `app/inbox/actions.ts`:

```ts
export async function archiveConversation(formData: FormData) {
  const id = String(formData.get("conversation_id"));
  const supabase = await createClient();
  await supabase.rpc("set_conversation_archived", { p_conversation_id: id, p_archived: true });
  revalidatePath("/inbox");
}
export async function unarchiveConversation(formData: FormData) {
  const id = String(formData.get("conversation_id"));
  const supabase = await createClient();
  await supabase.rpc("set_conversation_archived", { p_conversation_id: id, p_archived: false });
  revalidatePath("/inbox");
}
export async function bulkArchiveConversations(formData: FormData) {
  const ids = formData.getAll("conversation_id").map(String);
  const supabase = await createClient();
  for (const id of ids) {
    await supabase.rpc("set_conversation_archived", { p_conversation_id: id, p_archived: true });
  }
  revalidatePath("/inbox");
}
```

- [ ] **Step 7: Wire the Archived tab** in `app/inbox/page.tsx` — compute `isArchivedForUser(c, user.id)` per conversation; `archived` filter shows archived rows, all other filters exclude them. Add an "Unarchive" action on archived rows.

- [ ] **Step 8: Apply migration locally + build**

```bash
npx supabase migration up   # or the project's migration command
pnpm test archive-visibility
pnpm build
```

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/0028_conversation_archive.sql app/inbox/actions.ts app/inbox/page.tsx lib/inbox/archive.ts lib/inbox/__tests__/archive-visibility.test.ts
git commit -m "feat(inbox): working per-participant archive (schema, actions, tab, bulk)"
```

---

## Task 5: Pinned composer + collapsible send-offer panel

**Files:**
- Modify: `components/inbox/conversation-thread.tsx:15-179`
- Create: `components/inbox/send-offer-panel.tsx`
- Modify: `components/app-shell.tsx:19-26` (allow the pane to host a flex-column thread)

**Interfaces:**
- Produces: `ConversationThread` renders a `flex h-full flex-col`: a scrollable `<div className="flex-1 overflow-y-auto">` for messages and a non-scrolling footer `<div className="border-t">` containing the composer and `<SendOfferPanel>`. `SendOfferPanel` is a client `<details>` (collapsed by default, `open` when `?focus=offer`) wrapping the existing `sendOffer` form so it is always available yet compact.

- [ ] **Step 1: Read** `components/inbox/conversation-thread.tsx` and `components/app-shell.tsx:19-26` to confirm the pane is currently a single scrolling block.

- [ ] **Step 2: Adjust the shell pane** — ensure the `<aside>` and main column let a child own its own scroll: change the pane wrapper so the child can be `h-full` (e.g. the aside stays `overflow-hidden` and the thread manages internal scroll). Keep mobile (`/inbox/[id]`) as normal page flow.

- [ ] **Step 3: Create `SendOfferPanel`**

```tsx
// components/inbox/send-offer-panel.tsx
"use client";
export function SendOfferPanel({ open, children }: { open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="rounded-lg border border-[var(--border)]">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
        Send an offer
      </summary>
      <div className="border-t border-[var(--divider)] p-3">{children}</div>
    </details>
  );
}
```

- [ ] **Step 4: Restructure `ConversationThread`** — wrap messages in the scrollable region; move `MessageComposer` and the `sendOffer` form (wrapped in `SendOfferPanel`) into the pinned footer. The offer panel stays visible whenever the brand can send an offer (drop the "hidden when pending offer" collapse to instead render disabled/summary state). Keep `AutoScroll` behavior (`?focus=offer` → `open`).

- [ ] **Step 5: Add a smoke test** asserting the thread footer is structurally separate from the scroll region.

```ts
// components/inbox/__tests__/thread-layout.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
it("thread has a scrollable messages region and a pinned footer", () => {
  const src = readFileSync("components/inbox/conversation-thread.tsx", "utf8");
  expect(src).toMatch(/flex-1 overflow-y-auto/);
  expect(src).toMatch(/border-t/);
  expect(src).toMatch(/SendOfferPanel/);
});
```

- [ ] **Step 6: Run test + manual verify** — messages scroll under a fixed composer; the offer bar collapses/expands; `?focus=offer` opens it.

- [ ] **Step 7: Build + commit**

```bash
git add components/inbox/conversation-thread.tsx components/inbox/send-offer-panel.tsx components/app-shell.tsx components/inbox/__tests__/thread-layout.test.ts
git commit -m "feat(inbox): pinned composer with scrollable thread + collapsible offer panel"
```

---

## Self-Review

1. **Coverage vs call:** listicle+checkbox (T3), default show-everyone (T2), pinned composer + collapsible always-on offer bar (T5), newest-on-top (T1), working archive (T4). Persistent single conversation was already DONE — intentionally omitted.
2. **Placeholders:** none — SQL, TS helpers, and tests are complete.
3. **Type consistency:** `sortConversationsByActivity`, `toggleSelection`, `isArchivedForUser`, `set_conversation_archived(uuid, boolean)`, `SendOfferPanel({ open, children })` used consistently across tasks.
4. **Migration:** `0028` assumed; adjust number if another plan lands first (contents unchanged).

## Execution Handoff

Plan saved. **(1) Subagent-Driven (recommended)** or **(2) Inline**. Suggested order: T1 → T2 → T4 (schema) → T3 (needs bulk action from T4) → T5. T5 is independent of T3/T4 and can run in parallel.
