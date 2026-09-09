# WS3 — Taxonomy, Campaign Visibility & Invite-to-Campaign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align terminology and the brand→creator flow with the 2026-09-07 call: standardize copy so creator→brand is always "send offer" and brand→creator is always "send campaign"; add an explicit `visibility` on campaigns (public when created via Create Campaign, private when sent 1:1 from a chat); and turn the existing chat "invite" into "invite to campaign" that immediately opens the conversation, offers a picker of the brand's live campaigns, and keeps an accept/decline step whose timing feeds a response-time metric.

**Architecture:** Three layers. (1) A copy pass replacing the three offer-string variants and the "invite to chat" strings, backed by a single `lib/copy/taxonomy.ts` constants module so labels can't drift again. (2) A migration adding `campaigns.visibility` (`'public' | 'private'`, default `'public'`) with RLS so private campaigns are visible only to their brand and invited creators, plus a `campaign_invites` link so a private campaign targets specific creators. (3) An "Invite to campaign" action from discover/inbox that finds-or-creates the conversation, records the campaign invite, redirects straight into `/inbox?c=` (conversation open), and preserves the accept/decline step; response time is derived from `conversations.responded_at` (already set by trigger) exposed as a computed metric.

**Tech Stack:** Next.js 16.3.1 (App Router, Server Components/Actions), Supabase (Postgres + RLS), TypeScript, Vitest.

**Source audit:** verification round 2026-09-09. `visibility` column does not exist; no "send campaign" string exists; invites are chat-only and land on the inbox list, not the open conversation.

## Global Constraints

- **Next migration number:** `0029` (assumes WS1 took `0028`; use the next free number if order differs — contents unchanged).
- **Taxonomy is law:** creator→brand action label = **"Send offer"** (verb) / **"offer"** (noun); brand→creator action label = **"Send campaign"** (verb) / **"campaign"** (noun). All user-facing strings and button copy use `lib/copy/taxonomy.ts`.
- **Keep accept/decline** — do not remove it; it is the response-time KPI source.
- **DESIGN.md App register** for all touched surfaces.
- Run `pnpm test` and `pnpm build` before each commit.

---

## File Structure

- `lib/copy/taxonomy.ts` — exported label constants (`OFFER_VERB`, `CAMPAIGN_VERB`, etc.) + tests.
- `supabase/migrations/0029_campaign_visibility_invites.sql` — `campaigns.visibility` column, `campaign_invites` table, RLS updates, `invite_to_campaign` RPC, `campaign_response_time` view.
- `app/campaigns/actions.ts` — `createCampaign` sets `visibility = 'public'`.
- `app/discover/actions.ts` / new `app/campaigns/[id]/invite-actions.ts` — `inviteToCampaign` action.
- `components/discover/*`, `app/c/[handle]/*`, `app/campaigns/[id]/bulk-proposals.tsx` — replace "Invite to chat" with "Invite to campaign" (+ campaign picker).
- `components/inbox/*`, `app/inbox/[id]/page.tsx` — offer copy via taxonomy constants.
- `lib/campaigns/response-time.ts` — pure duration helper + tests.

---

## Task 1: Taxonomy constants + copy pass

**Files:**
- Create: `lib/copy/taxonomy.ts`
- Test: `lib/copy/__tests__/taxonomy.test.ts`
- Modify (offer copy → constants): `app/inbox/[id]/page.tsx:149,324,386`, `components/inbox/conversation-thread.tsx:117,151,177`, `app/inbox/[id]/page.tsx:180,144,218`
- Modify (brand→creator copy → "campaign"): `app/c/[handle]/page.tsx:190`, `app/discover/page.tsx:341,356`, `app/campaigns/[id]/bulk-proposals.tsx:220`, `app/brand/settings/page.tsx:209,222`

**Interfaces:**
- Produces:

```ts
// lib/copy/taxonomy.ts
export const OFFER_VERB = "Send offer";       // creator-facing brand action to send an offer
export const OFFER_CTA = "Make an offer";
export const OFFER_NOUN = "offer";
export const CAMPAIGN_VERB = "Send campaign"; // brand → creator
export const CAMPAIGN_INVITE_CTA = "Invite to campaign";
export const CAMPAIGN_NOUN = "campaign";
```

- [ ] **Step 1: Write the failing test** locking the canonical strings.

```ts
// lib/copy/__tests__/taxonomy.test.ts
import { describe, it, expect } from "vitest";
import * as t from "../taxonomy";
describe("taxonomy", () => {
  it("uses the agreed verbs", () => {
    expect(t.OFFER_VERB).toBe("Send offer");
    expect(t.CAMPAIGN_VERB).toBe("Send campaign");
    expect(t.CAMPAIGN_INVITE_CTA).toBe("Invite to campaign");
  });
});
```

- [ ] **Step 2: Run test** — `pnpm test taxonomy` → FAIL (module missing).

- [ ] **Step 3: Create `lib/copy/taxonomy.ts`** with the constants above.

- [ ] **Step 4: Run test** — PASS.

- [ ] **Step 5: Replace offer strings** — import and use `OFFER_VERB`/`OFFER_CTA`/`OFFER_NOUN` at each cited location so "Make an offer"/"Send an offer"/"Send offer" collapse to the two canonical forms (`OFFER_CTA` for the header CTA, `OFFER_VERB` for the submit button).

- [ ] **Step 6: Replace brand→creator strings** — swap "Invite to chat"/"Invite selected"/"Invite creators" for `CAMPAIGN_INVITE_CTA` where the action targets a campaign (see Task 4). For the off-platform invite link in `brand/settings`, keep "Create invite" (that is a signup link, not a campaign send) but note it in the plan so reviewers don't flag it.

- [ ] **Step 7: Add a guard test** ensuring the deprecated variant "Send an offer" no longer appears in the two thread files.

```ts
// lib/copy/__tests__/no-variant-strings.test.ts
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
it("no ad-hoc 'Send an offer' variant in thread", () => {
  const a = readFileSync("components/inbox/conversation-thread.tsx", "utf8");
  expect(a.includes('"Send an offer"')).toBe(false);
});
```

- [ ] **Step 8: Run test + build + commit**

```bash
pnpm test taxonomy && pnpm build
git add lib/copy/taxonomy.ts lib/copy/__tests__ app/inbox app/c app/discover app/campaigns app/brand components/inbox
git commit -m "refactor(copy): centralize offer/campaign taxonomy and unify labels"
```

---

## Task 2: Campaign visibility column + invites schema + RLS

**Files:**
- Create: `supabase/migrations/0029_campaign_visibility_invites.sql`
- Reference: `supabase/migrations/0014_campaigns.sql:18-20` (current select policy)

**Interfaces:**
- Produces:
  - `campaigns.visibility text not null default 'public' check (visibility in ('public','private'))`.
  - `campaign_invites (campaign_id, creator_id, conversation_id, invited_at, unique(campaign_id, creator_id))`.
  - RLS: public+open campaigns readable by all authenticated; private campaigns readable by brand owner and invited creators only.
  - `invite_to_campaign(p_campaign_id uuid, p_creator_id uuid) returns uuid` (returns conversation id; finds-or-creates the conversation, inserts the invite, sets conversation to `invited` if new).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0029_campaign_visibility_invites.sql
alter table public.campaigns
  add column if not exists visibility text not null default 'public'
  check (visibility in ('public','private'));

create table if not exists public.campaign_invites (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  invited_at timestamptz not null default now(),
  unique (campaign_id, creator_id)
);
alter table public.campaign_invites enable row level security;

-- brand owner sees invites for own campaigns; invited creator sees own
create policy "brand sees own campaign invites" on public.campaign_invites
  for select to authenticated using (
    exists (select 1 from public.campaigns c where c.id = campaign_id and c.brand_id = (select auth.uid()))
    or creator_id = (select auth.uid())
  );

-- replace campaign select policy to honor visibility
drop policy if exists "open campaigns readable by authenticated, owners see own" on public.campaigns;
create policy "campaigns visibility policy" on public.campaigns
  for select to authenticated using (
    (visibility = 'public' and status = 'open')
    or brand_id = (select auth.uid())
    or exists (
      select 1 from public.campaign_invites ci
      where ci.campaign_id = id and ci.creator_id = (select auth.uid())
    )
  );

create or replace function public.invite_to_campaign(
  p_campaign_id uuid,
  p_creator_id uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_brand uuid;
  v_conv_id uuid;
begin
  select brand_id into v_brand from public.campaigns where id = p_campaign_id;
  if v_brand is null then raise exception 'campaign not found'; end if;
  if v_brand <> v_uid then raise exception 'not campaign owner'; end if;

  select id into v_conv_id from public.conversations
    where brand_id = v_uid and creator_id = p_creator_id;
  if v_conv_id is null then
    insert into public.conversations (brand_id, creator_id, status, invite_message)
    values (v_uid, p_creator_id, 'invited', 'You have been invited to a campaign')
    returning id into v_conv_id;
  end if;

  insert into public.campaign_invites (campaign_id, creator_id, conversation_id)
  values (p_campaign_id, p_creator_id, v_conv_id)
  on conflict (campaign_id, creator_id) do update set conversation_id = excluded.conversation_id;

  return v_conv_id;
end;
$$;
grant execute on function public.invite_to_campaign(uuid, uuid) to authenticated;
```

- [ ] **Step 2: Apply migration locally** — `npx supabase migration up`; confirm no errors and existing campaigns default to `visibility='public'`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0029_campaign_visibility_invites.sql
git commit -m "feat(campaigns): add visibility + campaign_invites + invite_to_campaign RPC"
```

---

## Task 3: Create Campaign sets visibility = public

**Files:**
- Modify: `app/campaigns/actions.ts:50-60` (`createCampaign` insert)

**Interfaces:**
- Produces: campaigns created via the Create Campaign form are explicitly `visibility='public'` (default already covers it, but set it explicitly for clarity and to contrast with invite-created private campaigns in WS-future work).

- [ ] **Step 1: Implement** — add `visibility: "public"` to the insert payload in `createCampaign`.

- [ ] **Step 2: Build + commit**

```bash
pnpm build
git add app/campaigns/actions.ts
git commit -m "feat(campaigns): mark Create Campaign campaigns as public"
```

---

## Task 4: Invite-to-campaign flow (open conversation + live-campaign picker)

**Files:**
- Create: `app/campaigns/[id]/invite-actions.ts` (or extend `app/discover/actions.ts`) — `inviteToCampaign`
- Create: `components/discover/invite-to-campaign.tsx` — client campaign picker
- Modify: `app/discover/page.tsx` (per-card + bulk "Invite to campaign"), `app/c/[handle]/page.tsx:182-191`, `app/campaigns/[id]/bulk-proposals.tsx:207-222`
- Test: `app/campaigns/__tests__/invite-to-campaign.test.ts` (redirect target) + picker filtering test

**Interfaces:**
- Consumes: `invite_to_campaign(p_campaign_id, p_creator_id)` RPC (Task 2).
- Produces:

```ts
// app/campaigns/[id]/invite-actions.ts
export async function inviteToCampaign(formData: FormData): Promise<void>;
// reads: campaign_id, creator_id (or creator_id[] for bulk)
// calls RPC per creator, then redirect(`/inbox?c=${conversationId}`)  // single
```

- [ ] **Step 1: Write a failing test** for the picker's live-campaign filter (pure helper).

```ts
// lib/campaigns/__tests__/live-campaigns.test.ts
import { describe, it, expect } from "vitest";
import { liveCampaigns } from "../live-campaigns";
describe("liveCampaigns", () => {
  it("returns only open campaigns owned by the brand", () => {
    const rows = [
      { id: "1", status: "open" }, { id: "2", status: "closed" },
    ];
    expect(liveCampaigns(rows).map((c) => c.id)).toEqual(["1"]);
  });
});
```

- [ ] **Step 2: Run test** — FAIL.

- [ ] **Step 3: Implement helper**

```ts
// lib/campaigns/live-campaigns.ts
export function liveCampaigns<T extends { status: string }>(rows: T[]): T[] {
  return rows.filter((c) => c.status === "open");
}
```

- [ ] **Step 4: Run test** — PASS.

- [ ] **Step 5: Build the picker `InviteToCampaign`** — a client component: a button labeled `CAMPAIGN_INVITE_CTA` that opens a small popover/menu listing the brand's live campaigns (fetched server-side and passed as props). Selecting one submits a form to `inviteToCampaign` with `campaign_id` + `creator_id`. If the brand has exactly one live campaign, skip the menu and submit directly. If zero, link to Create Campaign.

- [ ] **Step 6: Implement `inviteToCampaign`** — validate ownership, call the RPC per creator, and for the single-creator case `redirect(`/inbox?c=${conversationId}`)` so the conversation opens immediately (no extra "open conversation" click). For bulk, redirect to `/inbox?sent=N`.

- [ ] **Step 7: Replace call sites** — discover per-card and bulk actions, storefront button, and campaign proposals panel now use `InviteToCampaign` instead of `inviteFromStorefront`/`sendReachouts` where the intent is inviting to a campaign. (Plain chat reachout may remain as a secondary action if desired, but the primary brand→creator CTA is "Invite to campaign".)

- [ ] **Step 8: Redirect test**

```ts
// app/campaigns/__tests__/invite-to-campaign.test.ts
import { describe, it, expect } from "vitest";
import { inviteRedirect } from "../../../lib/campaigns/invite-redirect";
describe("inviteRedirect", () => {
  it("opens the conversation for a single invite", () => {
    expect(inviteRedirect("conv1", 1)).toBe("/inbox?c=conv1");
  });
  it("returns to inbox list for bulk", () => {
    expect(inviteRedirect(null, 5)).toBe("/inbox?sent=5");
  });
});
```
  Implement `lib/campaigns/invite-redirect.ts` accordingly and use it in the action.

- [ ] **Step 9: Run tests + build + manual verify** — inviting a creator to a campaign from discover lands directly in the open conversation; accept/decline still present for the creator.

- [ ] **Step 10: Commit**

```bash
git add app/campaigns/[id]/invite-actions.ts components/discover/invite-to-campaign.tsx lib/campaigns/live-campaigns.ts lib/campaigns/invite-redirect.ts lib/campaigns/__tests__ app/campaigns/__tests__ app/discover app/c app/campaigns/[id]/bulk-proposals.tsx
git commit -m "feat(campaigns): invite-to-campaign opens conversation with live-campaign picker"
```

---

## Task 5: Response-time metric from accept/decline

**Files:**
- Create: `lib/campaigns/response-time.ts`
- Test: `lib/campaigns/__tests__/response-time.test.ts`
- Modify: `supabase/migrations/0029_campaign_visibility_invites.sql` (append a `campaign_response_time` view) OR add read in an admin query
- Modify: `app/admin/deals/page.tsx` or a brand-facing stat (surface average response time)

**Interfaces:**
- Produces: `responseTimeMs(invitedAt: string, respondedAt: string | null): number | null` and an aggregate the admin panel can display. `conversations.responded_at` is already set by the trigger in `0017_conversations.sql:97-101`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/campaigns/__tests__/response-time.test.ts
import { describe, it, expect } from "vitest";
import { responseTimeMs } from "../response-time";
describe("responseTimeMs", () => {
  it("computes elapsed ms", () => {
    expect(responseTimeMs("2026-01-01T00:00:00Z", "2026-01-01T01:00:00Z")).toBe(3600000);
  });
  it("returns null when unresponded", () => {
    expect(responseTimeMs("2026-01-01T00:00:00Z", null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test** — FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/campaigns/response-time.ts
export function responseTimeMs(invitedAt: string, respondedAt: string | null): number | null {
  if (!respondedAt) return null;
  return new Date(respondedAt).getTime() - new Date(invitedAt).getTime();
}
```

- [ ] **Step 4: Run test** — PASS.

- [ ] **Step 5: Surface it** — add an admin read (average response time across invites) using `campaign_invites.invited_at` + `conversations.responded_at`, computed with `responseTimeMs`. Keep it read-only.

- [ ] **Step 6: Build + commit**

```bash
git add lib/campaigns/response-time.ts lib/campaigns/__tests__/response-time.test.ts app/admin
git commit -m "feat(metrics): creator response time from invite→accept/decline"
```

---

## Self-Review

1. **Coverage vs call:** unified taxonomy (T1), visibility public/private (T2–T3), invite-to-campaign opening the conversation + live-campaign picker + kept accept/decline (T4), response-time KPI (T5).
2. **Placeholders:** none — SQL, RPC, helpers, and tests are concrete.
3. **Type consistency:** `invite_to_campaign(uuid, uuid)`, `inviteRedirect(convId, count)`, `liveCampaigns(rows)`, `responseTimeMs(invitedAt, respondedAt)`, taxonomy constants used consistently.
4. **Migration:** `0029` assumed after WS1's `0028`.

## Execution Handoff

Plan saved. **(1) Subagent-Driven (recommended)** or **(2) Inline**. Order: T2 (schema) → T3 → T4 → T5; T1 (copy) is independent and can run first or in parallel.
