# Deal Flow Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce friction in the brand→deal lifecycle by unifying conversation context, standardizing briefs, surfacing key actions earlier, and fixing mobile navigation.

**Architecture:** Five independent changes (A–E) to existing pages and two SQL RPCs. No new tables, no schema changes. Each task produces a working, testable change that can ship alone.

**Tech Stack:** Next.js (App Router, Server Components), Supabase (Postgres RPCs, RLS), Tailwind CSS, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-09-02-deal-flow-optimization-design.md`

## Global Constraints

- **Design system:** Follow `DESIGN.md` — Gallery Frame. Ink pills for primary actions, outlined pills for secondary. Cards use `rounded-2xl bg-card p-6 shadow-card`. Amber only for trust/attention states.
- **No new dependencies.** All changes use existing components and patterns.
- **No schema migrations.** Brief standardization (Task C) changes SQL RPCs via a new migration file but adds no tables or columns.
- **Server Components by default.** Client components only where interactivity requires it.
- **RLS enforced.** All queries go through the Supabase client which respects row-level security.

---

### Task 1: Unified Thread — Show Conversation History in Deal View

**Files:**
- Modify: `app/deals/[id]/page.tsx:36-51` (add conversation message query)
- Modify: `app/deals/[id]/page.tsx:190-192` (render pre-deal section above DealMessages)

**Interfaces:**
- Consumes: `deal_events` table (action = `offer_accepted`, metadata contains `conversation_id`), `messages` table (where `conversation_id = X`)
- Produces: A collapsible "Pre-deal discussion" section rendered before `<DealMessages>`. No new exports.

- [ ] **Step 1: Add conversation message query to deal page**

In `app/deals/[id]/page.tsx`, after the existing `Promise.all` block (lines 44-51), add a second query that traces the deal back to its originating conversation via `deal_events`:

```tsx
// after line 51, add:
let conversationMessages: { id: string; sender_id: string; body: string; created_at: string }[] = [];
{
  const offerEvent = (events ?? []).find((e) => e.action === "offer_accepted");
  if (offerEvent) {
    // deal_events.metadata is returned as jsonb — cast via the select
    const { data: fullEvent } = await supabase
      .from("deal_events")
      .select("metadata")
      .eq("deal_id", id)
      .eq("action", "offer_accepted")
      .maybeSingle();
    const convId = fullEvent?.metadata?.conversation_id;
    if (convId) {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, body, created_at")
        .eq("conversation_id", convId)
        .order("created_at");
      conversationMessages = data ?? [];
    }
  }
}
```

Note: The `events` query on line 46 only selects `action, from_status, to_status, created_at` — no `metadata`. We need a separate targeted query for the metadata. This avoids changing the existing events query shape.

- [ ] **Step 2: Render pre-deal discussion section**

In `app/deals/[id]/page.tsx`, replace line 192 (`<DealMessages dealId={deal.id} userId={user.id} />`) with:

```tsx
{conversationMessages.length > 0 && (
  <details className="mt-6 rounded-xl border p-5">
    <summary className="cursor-pointer text-base font-bold">
      Pre-deal discussion
      <span className="ml-2 text-sm font-normal text-muted-foreground">
        {conversationMessages.length} message{conversationMessages.length !== 1 ? "s" : ""}
      </span>
    </summary>
    <ul className="mt-3 flex flex-col gap-2">
      {conversationMessages.map((m) => (
        <li
          key={m.id}
          className={`max-w-[85%] rounded-lg p-3 text-sm ${
            m.sender_id === user.id
              ? "self-end bg-primary/10 text-foreground"
              : "self-start bg-secondary"
          }`}
        >
          <p className="whitespace-pre-line break-words">{m.body}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(m.created_at).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      Deal started
      <span className="h-px flex-1 bg-border" />
    </div>
  </details>
)}

<DealMessages dealId={deal.id} userId={user.id} />
```

Design notes:
- Uses `<details>` for collapse — native HTML, no client JS needed.
- Pre-deal messages use `bg-primary/10` (not full `bg-primary`) to visually distinguish from deal messages. This keeps them readable but secondary.
- "Deal started" divider separates conversation history from deal thread.

- [ ] **Step 3: Test in browser**

1. Find or create a deal that originated from an offer (accepted via inbox).
2. Navigate to `/deals/[that-deal-id]`.
3. Verify: "Pre-deal discussion" section appears above "Messages", collapsed by default.
4. Open it — conversation messages display in chronological order.
5. Navigate to a deal from direct booking or campaign — verify section does NOT appear.
6. Check mobile layout is not broken.

- [ ] **Step 4: Commit**

```bash
git add app/deals/[id]/page.tsx
git commit -m "feat: show conversation history in deal view (unified thread)"
```

---

### Task 2: Inline Deal Actions on Brand Dashboard

**Files:**
- Modify: `app/brand/page.tsx:10-16` (no change to DEAL_LABELS, but reference)
- Modify: `app/brand/page.tsx:153-173` (add action buttons to deal rows)
- Modify: `app/brand/page.tsx:1-8` (add import for `performDealAction`)

**Interfaces:**
- Consumes: `performDealAction` from `app/deals/[id]/actions.ts`, `actionsFor` from `lib/deals/ui-actions.ts`
- Produces: Action buttons inline on dashboard deal rows. No new exports.

- [ ] **Step 1: Add imports**

At the top of `app/brand/page.tsx`, add:

```tsx
import { actionsFor } from "@/lib/deals/ui-actions";
import type { DealStatus, PaymentMode } from "@/lib/deals/machine";
import { performDealAction } from "@/app/deals/[id]/actions";
```

- [ ] **Step 2: Add inline action buttons to "Deals in progress" rows**

Replace the deal row rendering in the `inProgress.map` block (lines 154-172) with a version that adds contextual action buttons:

```tsx
{inProgress.map((d) => {
  const dealActions = actionsFor(
    d.status as DealStatus,
    "brand",
    (d as any).payment_mode as PaymentMode ?? "off_platform"
  );
  // only surface safe, non-destructive quick actions
  const quickAction = dealActions.find(
    (a) => !a.confirm && !a.needsUrl && ["approve"].includes(a.action)
  );

  return (
    <li key={d.id} className="flex items-center gap-2">
      <Link
        href={`/deals/${d.id}`}
        className="deal-row flex flex-1 items-center justify-between gap-4 rounded-2xl bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
      >
        <span className="min-w-0 truncate">
          <span className="font-medium">{creatorLabel(d.creator_id)}</span>
          <span className="text-muted-foreground"> · {d.offering_title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <Badge variant="secondary">{DEAL_LABELS[d.status] ?? d.status}</Badge>
          <span className="font-extrabold tabular-nums text-primary">
            ${(d.price_cents / 100).toFixed(2)}
          </span>
        </span>
      </Link>
      {quickAction && (
        <form action={performDealAction}>
          <input type="hidden" name="deal_id" value={d.id} />
          <input type="hidden" name="action" value={quickAction.action} />
          <Button type="submit" size="sm">
            {quickAction.label}
          </Button>
        </form>
      )}
    </li>
  );
})}
```

Important notes:
- The current deals query (line 39-42) selects `id, creator_id, offering_title, price_cents, status, requested_at` — it does NOT include `payment_mode`. We need to add it.
- `performDealAction` redirects to `/deals/${dealId}` after completing — so clicking "Approve" on the dashboard takes the brand to the deal detail page showing the completed state. This is acceptable UX (brand sees confirmation).

In the deals query (line 39), change the select to:

```tsx
.select("id, creator_id, offering_title, price_cents, status, requested_at, payment_mode")
```

- [ ] **Step 3: Test in browser**

1. Navigate to `/brand`.
2. Verify deals in "Deals in progress" still render correctly.
3. Find a deal with status `published` — verify "Approve & complete" button appears next to it.
4. Click the button — verify deal transitions to `completed` and page refreshes.
5. Verify deals with status `submitted`, `in_production`, etc. show NO inline button (those actions need URL input or are destructive).
6. Verify the row is still clickable to navigate to the full deal page.

- [ ] **Step 4: Commit**

```bash
git add app/brand/page.tsx
git commit -m "feat: add inline deal actions on brand dashboard"
```

---

### Task 3: Standardize the Brief Across All Three Deal Paths

**Files:**
- Create: `supabase/migrations/0025_brief_standardization.sql` (new migration — check actual next number by listing migrations directory)
- Modify: No app code changes (RPCs are called via `supabase.rpc()` — the app code doesn't need updating)

**Interfaces:**
- Consumes: `brand_products` table (to auto-fill `product_description`), `campaigns` table, `campaign_applications` table, `offers` table, `conversations` table
- Produces: Updated `accept_offer()` and `accept_campaign_application()` RPCs that populate all three brief fields

- [ ] **Step 1: Check the next migration number**

```bash
ls supabase/migrations/ | tail -5
```

Use the next sequential number for the migration file.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/NNNN_brief_standardization.sql` (use actual next number):

```sql
-- Standardize brief population across all deal creation paths.
-- accept_offer: populate product_description from brand_products.
-- accept_campaign_application: populate product_description from brand_products.

create or replace function public.accept_offer(p_offer_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.offers;
  v_conv public.conversations;
  v_offering public.offerings;
  v_deal_id uuid;
  v_product_desc text;
begin
  select * into v_offer from public.offers o where o.id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;
  select * into v_conv from public.conversations c where c.id = v_offer.conversation_id;
  if v_uid is distinct from v_conv.creator_id then
    raise exception 'Only the creator can accept an offer';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'This offer has already been answered';
  end if;
  select * into v_offering from public.offerings o where o.id = v_offer.offering_id;
  if not found or not v_offering.active then
    raise exception 'That offering is no longer available';
  end if;

  -- auto-fill product description from brand's products
  select string_agg(bp.name, ', ' order by bp.name)
  into v_product_desc
  from public.brand_products bp
  where bp.brand_id = v_conv.brand_id;

  insert into public.deals
    (brand_id, creator_id, offering_id, offering_type, offering_title,
     price_cents, currency, revision_limit, payment_mode, status)
  values
    (v_conv.brand_id, v_conv.creator_id, v_offering.id, v_offering.type,
     v_offering.title, v_offering.price_cents, v_offering.currency,
     v_offering.revision_limit, 'off_platform', 'requested')
  returning id into v_deal_id;

  update public.deals set price_cents = v_offer.price_cents where id = v_deal_id;

  insert into public.briefs (deal_id, goals, product_description)
  values (v_deal_id,
          coalesce(v_offer.note, 'Agreed in conversation — see the thread.'),
          v_product_desc);

  insert into public.deal_events (deal_id, actor, action, metadata)
  values (v_deal_id, v_uid, 'offer_accepted',
          jsonb_build_object(
            'offer_id', v_offer.id,
            'conversation_id', v_conv.id,
            'listed_price_cents', v_offering.price_cents,
            'agreed_price_cents', v_offer.price_cents));

  perform set_config('clipline.internal', '1', true);
  update public.offers
  set status = 'accepted', decided_at = now(), deal_id = v_deal_id
  where id = p_offer_id;
  perform set_config('clipline.internal', '', true);

  return v_deal_id;
end;
$$;


create or replace function public.accept_campaign_application(p_application_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.campaign_applications;
  v_campaign public.campaigns;
  v_offering public.offerings;
  v_deal_id uuid;
  v_product_desc text;
begin
  select * into v_app from public.campaign_applications a
  where a.id = p_application_id for update;
  if not found then raise exception 'Application not found'; end if;
  select * into v_campaign from public.campaigns c where c.id = v_app.campaign_id;
  if v_uid is distinct from v_campaign.brand_id then
    raise exception 'Only the campaign brand can accept applications';
  end if;
  if v_app.status <> 'pending' then
    raise exception 'Only pending applications can be accepted';
  end if;

  select * into v_offering from public.offerings o
  where o.creator_id = v_app.creator_id
    and o.type = v_campaign.offering_type
    and o.active
  order by o.price_cents asc
  limit 1;
  if not found then
    raise exception 'This creator has no active % offering — ask them to add one, or book another format from their storefront',
      v_campaign.offering_type;
  end if;

  -- auto-fill product description from brand's products
  select string_agg(bp.name, ', ' order by bp.name)
  into v_product_desc
  from public.brand_products bp
  where bp.brand_id = v_campaign.brand_id;

  insert into public.deals
    (brand_id, creator_id, offering_id, offering_type, offering_title,
     price_cents, currency, revision_limit, payment_mode, status)
  values
    (v_campaign.brand_id, v_app.creator_id, v_offering.id, v_offering.type,
     v_offering.title, v_offering.price_cents, v_offering.currency,
     v_offering.revision_limit, 'off_platform', 'requested')
  returning id into v_deal_id;

  update public.deals
  set price_cents = v_app.proposed_price_cents
  where id = v_deal_id;

  insert into public.briefs (deal_id, goals, product_description, talking_points)
  values (v_deal_id,
          v_campaign.title || E'\n\n' || v_campaign.description,
          v_product_desc,
          v_app.pitch);

  insert into public.deal_events (deal_id, actor, action, metadata)
  values (v_deal_id, v_uid, 'campaign_accepted',
          jsonb_build_object(
            'campaign_id', v_campaign.id,
            'application_id', v_app.id,
            'listed_price_cents', v_offering.price_cents,
            'agreed_price_cents', v_app.proposed_price_cents));

  update public.campaign_applications
  set status = 'accepted', deal_id = v_deal_id
  where id = p_application_id;

  return v_deal_id;
end;
$$;
```

Changes from original RPCs:
- `accept_offer`: Added `v_product_desc` variable. Queries `brand_products` for the brand, aggregates names. Inserts `product_description` into briefs (was previously omitted).
- `accept_campaign_application`: Added `v_product_desc` variable. Queries `brand_products` for the brand, aggregates names. Inserts `product_description` into briefs (was previously omitted — only `goals` and `talking_points` were set).

- [ ] **Step 3: Test the migration locally**

```bash
npx supabase db reset
```

Then test both paths:
1. Accept an offer in inbox → check the deal's brief has `product_description` populated.
2. Accept a campaign application → check the deal's brief has all three fields populated.
3. Direct booking → verify it still works unchanged (not affected by this migration).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/NNNN_brief_standardization.sql
git commit -m "feat: auto-fill product_description in briefs for offer and campaign paths"
```

---

### Task 4: Promote Offer Action in Inbox Conversation

**Files:**
- Modify: `app/inbox/[id]/page.tsx:108-123` (add offer CTA to header area)
- Modify: `app/inbox/[id]/page.tsx:274-321` (remove old inline offer form)

**Interfaces:**
- Consumes: `conv`, `iAmBrand`, `hasPendingOffer`, `offerings`, `sendOffer` — all already available in the page
- Produces: Offer CTA in conversation header; offer form in a `<details>` disclosure widget. No new exports.

- [ ] **Step 1: Add offer CTA to conversation header**

In `app/inbox/[id]/page.tsx`, modify the header section (lines 108-123). After the existing `<Badge>` on line 121, add the offer CTA:

Replace lines 108-123 with:

```tsx
<div className="mt-3 flex flex-wrap items-center justify-between gap-3">
  <h1 className="text-3xl font-extrabold tracking-tight">{otherLabel}</h1>
  <span className="flex items-center gap-3">
    {iAmBrand && creatorProfile?.handle && (
      <Link
        href={`/c/${creatorProfile.handle}`}
        className="text-sm font-medium text-muted-foreground underline-offset-2 hover:underline"
      >
        @{creatorProfile.handle}
      </Link>
    )}
    {iAmBrand && conv.status === "accepted" && hasPendingOffer && (
      <Badge variant="secondary">
        Offer pending — ${((offers ?? []).find((o) => o.status === "pending")?.price_cents ?? 0) / 100}
      </Badge>
    )}
    {iAmBrand && conv.status === "accepted" && !hasPendingOffer && (offerings ?? []).length > 0 && (
      <a href="#offer-section" className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90">
        Make an offer
      </a>
    )}
    <Badge variant="secondary">
      {conv.status === "invited" ? "Invite pending" : conv.status === "declined" ? "Declined" : "Active"}
    </Badge>
  </span>
</div>
```

The "Make an offer" button is an ink pill (per DESIGN.md: `bg-foreground text-background rounded-full`) that anchor-links to the offer form section.

- [ ] **Step 2: Convert offer form section to a prominent, anchored section**

Replace lines 274-321 (the existing offer section) with:

```tsx
{iAmBrand && conv.status === "accepted" && !hasPendingOffer && (
  <section id="offer-section" className="mt-6 rounded-2xl bg-card p-6 shadow-card scroll-mt-20">
    <h2 className="text-base font-bold">Send an offer</h2>
    <p className="mt-1 text-sm text-muted-foreground">
      Agree on the work in chat, then put a price on it. Accepting
      starts the deal at your agreed price.
    </p>
    {(offerings ?? []).length === 0 ? (
      <p className="mt-3 text-sm text-muted-foreground">
        This creator has no active offerings to base an offer on.
      </p>
    ) : (
      <form action={sendOffer} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="conversation_id" value={conv.id} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="offer-offering">Offering</Label>
          <select
            id="offer-offering"
            name="offering_id"
            required
            className="h-10 rounded-lg border bg-background px-3 text-sm"
          >
            {(offerings ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.title} (listed ${(o.price_cents / 100).toFixed(0)})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="offer-price">Agreed price (USD)</Label>
          <Input id="offer-price" name="price" inputMode="decimal" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="offer-note">Scope note (optional, becomes the brief)</Label>
          <Textarea
            id="offer-note"
            name="note"
            rows={3}
            maxLength={2000}
            placeholder="What you agreed on: deliverable, angle, timing."
          />
        </div>
        <Button type="submit" size="sm" className="self-start">Send offer</Button>
      </form>
    )}
  </section>
)}
```

Changes from original:
- Added `id="offer-section"` and `scroll-mt-20` for the header anchor link.
- Upgraded card styling from `rounded-xl border p-5` to `rounded-2xl bg-card p-6 shadow-card` (matches design system cards used elsewhere on the page).
- Form content is identical — same fields, same server action.

- [ ] **Step 3: Test in browser**

1. Open an accepted conversation where no pending offer exists → verify "Make an offer" ink pill appears in the header.
2. Click it → page smooth-scrolls to the offer form section.
3. Submit an offer → verify "Offer pending — $X" badge appears in header and the form section disappears.
4. Open a conversation with a pending offer → verify badge shows instead of CTA.
5. Open a conversation as creator → verify no offer CTA appears.
6. Open a conversation with status "invited" → verify no offer CTA.
7. Check mobile — header should wrap gracefully.

- [ ] **Step 4: Commit**

```bash
git add app/inbox/[id]/page.tsx
git commit -m "feat: promote offer CTA to conversation header in inbox"
```

---

### Task 5: Fix Mobile Nav — Add Inbox Tab

**Files:**
- Modify: `components/mobile-nav.tsx:24-30` (restructure BRAND_TABS)
- Modify: `components/site-nav.tsx:64-78` (make notification bell visible on mobile)

**Interfaces:**
- Consumes: `unread` prop on MobileNav (already passed from SiteNav)
- Produces: Updated mobile nav with Inbox tab + badge; notification bell visible on mobile in top nav

- [ ] **Step 1: Update BRAND_TABS in MobileNav**

In `components/mobile-nav.tsx`, replace lines 24-30:

```tsx
const BRAND_TABS = [
  { href: "/brand", label: "Home", icon: HomeIcon },
  { href: "/discover", label: "Discover", icon: SearchIcon },
  { href: "/inbox", label: "Inbox", icon: MessageIcon },
  { href: "/deals", label: "Deals", icon: HandshakeIcon },
  { href: "/notifications", label: "Alerts", icon: BellIcon },
] as const;
```

This replaces the central "New Campaign" button with Inbox. The campaign creation action moves to existing CTAs on the Brand Home and Discover pages (both already have "Find creators" / campaign links).

- [ ] **Step 2: Add unread badge to Inbox tab**

In `components/mobile-nav.tsx`, update the badge rendering (line 82) to also show on Inbox:

Replace line 82:
```tsx
{tab.label === "Alerts" && unread > 0 && (
```

With:
```tsx
{(tab.label === "Alerts" || tab.label === "Inbox") && unread > 0 && (
```

Note: This reuses the notification `unread` count for the Inbox badge. This is a pragmatic simplification — the badge shows "you have unread notifications" which correlates with unread inbox activity since offer/message notifications are the primary notification type. A separate "unread conversations" count would be more precise but requires a new query; add when the distinction matters.

- [ ] **Step 3: Make notification bell visible on mobile**

In `components/site-nav.tsx`, line 67, the bell icon has `hidden ... md:grid` which hides it on mobile. Change it to always show:

Replace:
```tsx
className="relative hidden size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:grid"
```

With:
```tsx
className="relative grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
```

This makes the notification bell visible in the top nav on all screen sizes, since "Alerts" is no longer in the mobile bottom nav as a primary tab.

- [ ] **Step 4: Test in browser**

1. Open the app at mobile viewport (< 768px).
2. Verify bottom nav shows: Home | Discover | Inbox | Deals | Alerts.
3. Verify Inbox tab navigates to `/inbox`.
4. Verify Inbox tab shows unread badge when notifications exist.
5. Verify the notification bell is visible in the top nav bar on mobile.
6. Verify desktop layout is unchanged.
7. Verify creator mobile nav is unchanged (CREATOR_TABS was not modified).

- [ ] **Step 5: Commit**

```bash
git add components/mobile-nav.tsx components/site-nav.tsx
git commit -m "feat: add inbox tab to brand mobile nav, show notification bell on mobile"
```
