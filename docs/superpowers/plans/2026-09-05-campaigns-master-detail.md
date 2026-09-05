# Campaigns Master-Detail Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Campaigns page the same master-detail split-panel layout the Inbox already has — campaign list on the left, selected campaign detail in a side panel on the right (lg+), full-page navigation on mobile.

**Architecture:** The Inbox pattern works via a `?c={id}` query param on the list page. When present, the list page passes the detail view as the `pane` prop to `<AuthenticatedShell>`, which slots it into `<AppShell>`'s `<aside>` (42% width, max 28rem, lg+ only). The same detail component also powers the `/inbox/[id]` full-page route. We replicate this exact mechanism for Campaigns: extract a `<CampaignDetail>` server component from `app/campaigns/[id]/page.tsx`, wire it into the list page's `pane` prop, and add responsive dual-links on list items.

**Tech Stack:** Next.js (App Router, server components), Supabase, Tailwind CSS

**Spec:** User request + existing Inbox reference implementation (`app/inbox/page.tsx`, `components/inbox/conversation-list.tsx`, `components/inbox/conversation-thread.tsx`, `components/app-shell.tsx`)

## Global Constraints

- Follow DESIGN.md workspace register: no `shadow-card`, no `rounded-full` buttons, type caps at 24px/600 in-app, 8px radii on buttons/inputs
- Server components by default; `"use client"` only for interactive state
- All data fetching via Supabase server client
- Mobile (< lg) always navigates to full-page `/campaigns/[id]`; side panel is lg+ only
- No new dependencies

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `components/campaigns/campaign-detail.tsx` | **Create** | Reusable server component rendering the full campaign detail view (brief header, description, OwnerPanel or CreatorPanel). Accepts `compact` prop for side-panel mode. |
| `app/campaigns/page.tsx` | **Modify** | Add `c` query param handling, pass `<CampaignDetail>` as `pane` to `<AuthenticatedShell>`, make list items dual-link (lg+: `?c={id}`, mobile: `/campaigns/{id}`) |
| `app/campaigns/[id]/page.tsx` | **Modify** | Gut the inline detail rendering, delegate to `<CampaignDetail>` |
| `app/campaigns/actions.ts` | **Modify** | Server actions that redirect to `/campaigns/{id}?saved=1` need a `return_to` hidden field so the pane can redirect back to the list page instead |
| `app/campaigns/[id]/actions.ts` | **Modify** | Same `return_to` treatment for `applyToCampaign`, `withdrawApplication`, `decideApplication`, `bulkDecideApplications` |
| `app/campaigns/[id]/bulk-proposals.tsx` | **Modify** | Accept and forward `returnTo` for action redirects |
| `app/campaigns/[id]/edit-campaign-form.tsx` | **No change** | Already self-contained |

---

### Task 1: Extract `<CampaignDetail>` server component

The campaign detail page (`app/campaigns/[id]/page.tsx`) currently renders everything inline — the brief header, description, brand info, and then delegates to `OwnerPanel`/`CreatorPanel`. We extract all of this into a reusable server component so both the side pane and the full-page route can render it.

**Files:**
- Create: `components/campaigns/campaign-detail.tsx`
- Modify: `app/campaigns/[id]/page.tsx`

**Interfaces:**
- Consumes: `requireUser()`, `createServerSupabase()`, existing `OwnerPanel`/`CreatorPanel` (both stay in `app/campaigns/[id]/page.tsx` — they are not public, but `CampaignDetail` imports them)
- Produces: `<CampaignDetail campaignId={string} compact={boolean} returnTo={string | undefined} />` — used by Task 2 (list page pane) and this file's own page

**Design decision:** `OwnerPanel` and `CreatorPanel` are large server components with heavy data fetching. Moving them to a separate file would mean also moving their type definitions and the actions they import. Since they're only used by `CampaignDetail`, the cleanest approach is:
- Move `OwnerPanel`, `CreatorPanel`, and all shared helpers (`TYPE_LABELS`, `APPLICATION_LABELS`, `budgetRange`, `pitchPlaceholder`) into `components/campaigns/campaign-detail.tsx` alongside `CampaignDetail`
- `app/campaigns/[id]/page.tsx` becomes a thin wrapper that just calls `<CampaignDetail>`

- [ ] **Step 1: Create `components/campaigns/campaign-detail.tsx`**

Copy the entire content of `app/campaigns/[id]/page.tsx` into the new file, then reshape it:

```tsx
// components/campaigns/campaign-detail.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { applyToCampaign, withdrawApplication, decideApplication, bulkDecideApplications } from "@/app/campaigns/[id]/actions";
import { setCampaignStatus, editCampaign } from "@/app/campaigns/actions";
import { creatorCanApply } from "@/lib/campaigns/offering-match";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EditCampaignForm } from "@/app/campaigns/[id]/edit-campaign-form";
import { BulkProposals } from "@/app/campaigns/[id]/bulk-proposals";

const TYPE_LABELS: Record<string, string> = {
  dedicated_video: "Dedicated video",
  integration: "Integration (60-90s)",
  short_form_post: "Short-form post",
  ugc_video: "UGC video (no posting)",
};

const APPLICATION_LABELS: Record<string, string> = {
  pending: "Pending review",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

function pitchPlaceholder(offeringType: string): string {
  switch (offeringType) {
    case "dedicated_video":
      return "What angle would you take? Mention your audience size and why they'd care about this product.";
    case "integration":
      return "How would you weave this into your content? What video would this fit naturally into?";
    case "short_form_post":
      return "What hook would you use? What's your typical view count on shorts?";
    case "ugc_video":
      return "Describe your production style and turnaround. Include any relevant past UGC work.";
    default:
      return "Why you're the right creator for this: your angle, your audience, relevant work.";
  }
}

function budgetRange(minCents: number, maxCents: number) {
  const fmt = (c: number) => "$" + Math.round(c / 100).toLocaleString("en-US");
  return minCents === maxCents ? fmt(minCents) : `${fmt(minCents)}–${fmt(maxCents)}`;
}

export async function CampaignDetail({
  campaignId,
  compact = false,
  returnTo,
}: {
  campaignId: string;
  compact?: boolean;
  returnTo?: string;
}) {
  const { user, role } = await requireUser(`/campaigns/${campaignId}`);
  const supabase = await createServerSupabase();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, brand_id, title, description, offering_type, budget_min_cents, budget_max_cents, apply_by, status, created_at")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign) notFound();

  const isOwner = campaign.brand_id === user.id;
  const windowClosed =
    campaign.apply_by !== null && campaign.apply_by < new Date().toISOString().slice(0, 10);

  const { data: brandProfile } = await supabase
    .from("brand_profiles").select("company, website").eq("user_id", campaign.brand_id).maybeSingle();
  const { data: brandName } = await supabase
    .from("profiles").select("display_name").eq("id", campaign.brand_id).maybeSingle();

  return (
    <div className={compact ? "p-4" : ""}>
      {!compact && (
        <Link href="/campaigns" className="text-sm text-muted-foreground hover:text-foreground">
          ← Campaigns
        </Link>
      )}
      <div className={`${compact ? "" : "mt-3 "}flex flex-wrap items-baseline justify-between gap-3`}>
        <h1 className={`font-semibold tracking-tight ${compact ? "text-lg" : "text-2xl"}`}>
          {campaign.title}
        </h1>
        <span className={`font-extrabold tabular-nums text-primary ${compact ? "text-lg" : "text-2xl"}`}>
          {budgetRange(campaign.budget_min_cents, campaign.budget_max_cents)}
        </span>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {brandProfile?.company || brandName?.display_name || "A brand"} ·{" "}
        {TYPE_LABELS[campaign.offering_type] ?? campaign.offering_type}
        {campaign.apply_by ? ` · Apply by ${campaign.apply_by}` : ""}
        <Badge variant="secondary">{campaign.status === "open" && !windowClosed ? "open" : "closed"}</Badge>
      </p>

      <p className={`mt-6 whitespace-pre-wrap leading-relaxed ${compact ? "text-sm" : "max-w-prose text-[15px]"}`}>
        {campaign.description}
      </p>

      {isOwner && !compact && (
        <Link
          href={`/campaigns?clone=${campaign.id}`}
          className="mt-4 inline-block text-sm font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Use as template →
        </Link>
      )}

      {isOwner ? (
        <OwnerPanel
          campaignId={campaign.id}
          status={campaign.status}
          title={campaign.title}
          description={campaign.description}
          budgetMinCents={campaign.budget_min_cents}
          budgetMaxCents={campaign.budget_max_cents}
          applyBy={campaign.apply_by}
          supabase={supabase}
          compact={compact}
          returnTo={returnTo}
        />
      ) : role === "creator" ? (
        <CreatorPanel
          campaignId={campaign.id}
          open={campaign.status === "open" && !windowClosed}
          userId={user.id}
          budgetMinCents={campaign.budget_min_cents}
          budgetMaxCents={campaign.budget_max_cents}
          offeringType={campaign.offering_type}
          supabase={supabase}
          compact={compact}
          returnTo={returnTo}
        />
      ) : null}
    </div>
  );
}

// OwnerPanel and CreatorPanel move here verbatim from app/campaigns/[id]/page.tsx
// with two additions to each:
//   1. Accept `compact?: boolean` and `returnTo?: string` props
//   2. Forward `returnTo` to BulkProposals (OwnerPanel) and action forms (CreatorPanel)
//
// The full code for both is in the current app/campaigns/[id]/page.tsx lines 156-455.
// Copy them here with these prop additions. Key changes noted below.
```

The `OwnerPanel` signature becomes:
```tsx
async function OwnerPanel({
  campaignId, status, title, description, budgetMinCents, budgetMaxCents, applyBy,
  supabase, compact = false, returnTo,
}: {
  campaignId: string; status: string; title: string; description: string;
  budgetMinCents: number; budgetMaxCents: number; applyBy: string | null;
  supabase: Supabase; compact?: boolean; returnTo?: string;
}) {
  // ... identical data fetching ...
  // Pass returnTo to BulkProposals:
  // <BulkProposals ... returnTo={returnTo} />
}
```

The `CreatorPanel` signature becomes:
```tsx
async function CreatorPanel({
  campaignId, open, userId, budgetMinCents, budgetMaxCents, offeringType,
  supabase, compact = false, returnTo,
}: {
  campaignId: string; open: boolean; userId: string;
  budgetMinCents: number; budgetMaxCents: number; offeringType: string;
  supabase: Supabase; compact?: boolean; returnTo?: string;
}) {
  // ... identical data fetching ...
  // Add hidden return_to field to the apply form:
  // {returnTo && <input type="hidden" name="return_to" value={returnTo} />}
  // Same for withdraw form.
}
```

- [ ] **Step 2: Simplify `app/campaigns/[id]/page.tsx` to use `<CampaignDetail>`**

Replace the entire body with a thin wrapper:

```tsx
// app/campaigns/[id]/page.tsx
import { requireUser } from "@/lib/auth/require";
import { touchCursor } from "@/lib/feature-cursors";
import { AuthenticatedShell } from "@/components/authenticated-shell";
import { CampaignDetail } from "@/components/campaigns/campaign-detail";

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; invited?: string }>;
}) {
  const { id } = await params;
  const { user, role } = await requireUser(`/campaigns/${id}`);
  await touchCursor("campaigns");
  const { error, saved, invited } = await searchParams;

  return (
    <AuthenticatedShell userId={user.id} role={role}>
      <CampaignDetail campaignId={id} />
    </AuthenticatedShell>
  );
}
```

Note: The `error`/`saved`/`invited` flash messages should move into `CampaignDetail` (it reads its own `searchParams` via the URL, or we pass them as props). The simplest approach: `CampaignDetail` already calls `requireUser` and `createServerSupabase` — have it also accept optional `error`/`saved`/`invited` string props and render the banners. The page passes them through:

```tsx
<CampaignDetail campaignId={id} error={error} saved={saved} invited={invited} />
```

- [ ] **Step 3: Verify the full-page route still works**

Run: `pnpm dev` and navigate to `/campaigns/{any-id}` — should render identically to before.

- [ ] **Step 4: Commit**

```bash
git add components/campaigns/campaign-detail.tsx app/campaigns/[id]/page.tsx
git commit -m "refactor: extract CampaignDetail server component from campaign detail page"
```

---

### Task 2: Wire up master-detail pane on the campaigns list page

Now that `<CampaignDetail>` exists, the list page can render it in the `pane` slot when a campaign is selected via `?c={id}`.

**Files:**
- Modify: `app/campaigns/page.tsx`

**Interfaces:**
- Consumes: `<CampaignDetail campaignId={string} compact={boolean} returnTo={string} />` from Task 1
- Produces: The `pane` prop passed to `<AuthenticatedShell>` when `?c={id}` is present

- [ ] **Step 1: Add `c` query param to searchParams type**

In `app/campaigns/page.tsx`, add `c?: string` to the searchParams type:

```tsx
searchParams: Promise<{
  error?: string;
  saved?: string;
  clone?: string;
  prefill_type?: string;
  prefill_niche?: string;
  status?: string;
  offering_type?: string;
  c?: string;           // <-- add
}>;
```

- [ ] **Step 2: Extract `c` and resolve the selected campaign**

After `const sp = await searchParams;`, add:

```tsx
const selectedId = sp.c ?? null;
```

We need to verify the selected ID belongs to a campaign this user can see. For brands, it must be one of their campaigns. For creators, it must be an open campaign. The simplest approach: let `<CampaignDetail>` handle auth/404 internally (it already calls `requireUser` and checks campaign existence). We just pass it through — if the campaign doesn't exist or the user can't see it, the pane renders a 404.

- [ ] **Step 3: Pass `pane` to `<AuthenticatedShell>`**

Add the import and the pane prop:

```tsx
import { CampaignDetail } from "@/components/campaigns/campaign-detail";

// In the return:
<AuthenticatedShell
  userId={user.id}
  role={role}
  pane={selectedId ? <CampaignDetail campaignId={selectedId} compact returnTo={`/campaigns?c=${selectedId}`} /> : undefined}
>
```

- [ ] **Step 4: Verify side panel renders**

Run: `pnpm dev`, navigate to `/campaigns?c={some-campaign-id}` on a lg+ viewport. The campaign detail should appear in the right panel. On smaller viewports the panel should be hidden (AppShell's `lg:block`).

- [ ] **Step 5: Commit**

```bash
git add app/campaigns/page.tsx
git commit -m "feat: wire campaign detail into AppShell side pane via ?c= param"
```

---

### Task 3: Dual-link campaign list items (desktop panel vs mobile full-page)

The Inbox's `ConversationList` renders two `<Link>` elements per row: one visible on `md+` pointing to `?c={id}` (opens side pane), one visible on `<md` pointing to `/inbox/{id}` (full page). We apply the same pattern to the campaign list items in both `BrandCampaigns` and `CreatorCampaigns`.

**Files:**
- Modify: `app/campaigns/page.tsx` (the `BrandCampaigns` and `CreatorCampaigns` sub-components)

**Interfaces:**
- Consumes: Nothing new
- Produces: Campaign list items that open the side pane on lg+ and navigate to full page on mobile

- [ ] **Step 1: Update `BrandCampaigns` list item links**

In `BrandCampaigns`, the current `<Link>` (line ~182) goes to `/campaigns/${c.id}`. Replace each `<li>` with two links using the Inbox pattern:

```tsx
<li key={c.id}>
  {/* Desktop: open in side pane */}
  <Link
    href={`/campaigns?c=${c.id}${filterSp.toString() ? `&${filterSp.toString()}` : ""}`}
    className="hidden items-center justify-between gap-4 rounded-xl border p-5 transition-colors hover:border-primary/40 lg:flex"
  >
    {/* ... same inner content ... */}
  </Link>
  {/* Mobile: full page */}
  <Link
    href={`/campaigns/${c.id}`}
    className="flex items-center justify-between gap-4 rounded-xl border p-5 transition-colors hover:border-primary/40 lg:hidden"
  >
    {/* ... same inner content ... */}
  </Link>
</li>
```

Note the breakpoint is `lg` (not `md`) because AppShell's pane is `lg:block`. The desktop link preserves current filter params so they aren't lost when selecting a campaign.

To avoid duplicating the inner JSX, extract a render function:

```tsx
function CampaignRow({ campaign, stats }: { campaign: typeof filtered[number]; stats: Stats | undefined }) {
  return (
    <>
      <span className="min-w-0">
        <span className="block truncate font-bold">{campaign.title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">
          {TYPE_LABELS[campaign.offering_type] ?? campaign.offering_type}
          {campaign.apply_by ? ` · apply by ${campaign.apply_by}` : ""}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-4">
        {stats && (stats.pending > 0 || stats.accepted > 0 || stats.declined > 0) && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {[
              stats.pending > 0 && `${stats.pending} pending`,
              stats.accepted > 0 && `${stats.accepted} accepted`,
              stats.declined > 0 && `${stats.declined} declined`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
        <Badge variant="secondary">{campaign.status}</Badge>
        <span className="font-semibold tabular-nums text-primary">
          {budgetRange(campaign.budget_min_cents, campaign.budget_max_cents)}
        </span>
      </span>
    </>
  );
}
```

Then both links render `<CampaignRow campaign={c} stats={statsByCampaign.get(c.id)} />`.

- [ ] **Step 2: Update `CreatorCampaigns` list item links**

Same pattern. The current `<Link>` (line ~259) wraps a block with title, brand name, description. Apply the dual-link:

```tsx
<li key={c.id}>
  <Link
    href={`/campaigns?c=${c.id}`}
    className="hidden rounded-xl border p-5 transition-colors hover:border-primary/40 lg:block"
  >
    {/* ... same inner content ... */}
  </Link>
  <Link
    href={`/campaigns/${c.id}`}
    className="block rounded-xl border p-5 transition-colors hover:border-primary/40 lg:hidden"
  >
    {/* ... same inner content ... */}
  </Link>
</li>
```

- [ ] **Step 3: Verify responsive behavior**

Test at lg+ (1024px+): clicking a campaign list item should update the URL to `?c={id}` and show the detail pane. The list stays visible on the left.

Test at < lg: clicking navigates to `/campaigns/{id}` full page.

- [ ] **Step 4: Commit**

```bash
git add app/campaigns/page.tsx
git commit -m "feat: dual-link campaign list items for master-detail on desktop"
```

---

### Task 4: Server action redirects respect `return_to` for pane context

When the user acts from inside the side pane (accepts a proposal, applies, withdraws, edits), the server action redirects to `/campaigns/{id}?saved=1`. But the user is on `/campaigns?c={id}` — they should be redirected back there instead. The Inbox handles this with a `return_to` hidden field that the action reads and redirects to.

**Files:**
- Modify: `app/campaigns/actions.ts` (lines for `setCampaignStatus`, `editCampaign`)
- Modify: `app/campaigns/[id]/actions.ts` (all four actions)
- Modify: `app/campaigns/[id]/bulk-proposals.tsx` (forward `returnTo` into action forms)
- Modify: `components/campaigns/campaign-detail.tsx` (add hidden `return_to` fields in all forms)

**Interfaces:**
- Consumes: `returnTo` prop from Task 1's `CampaignDetail`
- Produces: Actions redirect to `return_to` value when present, falling back to `/campaigns/{id}`

- [ ] **Step 1: Add `return_to` support to `setCampaignStatus` in `app/campaigns/actions.ts`**

```tsx
export async function setCampaignStatus(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const returnTo = String(formData.get("return_to") ?? "");
  if (status !== "open" && status !== "closed") redirect(returnTo || `/campaigns/${id}`);

  const { error } = await supabase
    .from("campaigns").update({ status }).eq("id", id).eq("brand_id", user.id);
  const base = returnTo || `/campaigns/${id}`;
  const sep = base.includes("?") ? "&" : "?";
  if (error) {
    redirect(`${base}${sep}error=` + encodeURIComponent(friendlyDbError(error)));
  }
  redirect(`${base}${sep}saved=1`);
}
```

Apply the same pattern to `editCampaign`.

- [ ] **Step 2: Add `return_to` support to `app/campaigns/[id]/actions.ts`**

For each action (`applyToCampaign`, `withdrawApplication`, `decideApplication`, `bulkDecideApplications`), read `return_to` from formData and use it as the redirect base when present. The pattern is identical:

```tsx
const returnTo = String(formData.get("return_to") ?? "");
// ...
const base = returnTo || `/campaigns/${campaignId}`;
const sep = base.includes("?") ? "&" : "?";
redirect(`${base}${sep}saved=1`);
```

Exception: `decideApplication` with `decision === "accepted"` currently redirects to `/deals/${dealId}`. Keep that behavior — the user accepted a proposal and should land on the deal. The `return_to` only applies to the error path and the decline success path.

- [ ] **Step 3: Update `BulkProposals` to accept and forward `returnTo`**

In `app/campaigns/[id]/bulk-proposals.tsx`, add `returnTo?: string` to the props. In every `<form>` that calls `decideApplication` or `bulkDecideApplications`, add:

```tsx
{returnTo && <input type="hidden" name="return_to" value={returnTo} />}
```

- [ ] **Step 4: Add hidden `return_to` fields in `CampaignDetail` forms**

In `components/campaigns/campaign-detail.tsx`, in the `setCampaignStatus` form (OwnerPanel), the `applyToCampaign` form (CreatorPanel), and the `withdrawApplication` form (CreatorPanel), add:

```tsx
{returnTo && <input type="hidden" name="return_to" value={returnTo} />}
```

And pass `returnTo` to `<BulkProposals ... returnTo={returnTo} />`.

- [ ] **Step 5: Test the redirect loop**

From the side pane (`/campaigns?c={id}`): accept/decline a proposal, apply, withdraw, edit, close/reopen. Each should redirect back to `/campaigns?c={id}&saved=1` (or `&error=...`), keeping the user on the list page with the pane open.

From the full page (`/campaigns/{id}`): same actions should redirect to `/campaigns/{id}?saved=1` as before.

- [ ] **Step 6: Commit**

```bash
git add app/campaigns/actions.ts app/campaigns/[id]/actions.ts app/campaigns/[id]/bulk-proposals.tsx components/campaigns/campaign-detail.tsx
git commit -m "feat: server actions redirect to return_to for side-pane context"
```

---

### Task 5: Visual polish — active row highlight and compact adjustments

The Inbox highlights the selected conversation in the list. The side pane uses `compact` mode for tighter spacing. Apply the same polish to campaigns.

**Files:**
- Modify: `app/campaigns/page.tsx` (highlight selected row)
- Modify: `components/campaigns/campaign-detail.tsx` (compact-mode tweaks)

**Interfaces:**
- Consumes: `selectedId` from Task 2, `compact` prop from Task 1
- Produces: Visual polish only, no API changes

- [ ] **Step 1: Highlight the selected campaign row**

In both `BrandCampaigns` and `CreatorCampaigns`, the `selectedId` needs to be available. Since these are server sub-components inside the page, pass `selectedId` as a prop from the page component:

```tsx
<BrandCampaigns userId={user.id} supabase={supabase} tokens={tokens} selectedId={selectedId} />
// and
<CreatorCampaigns userId={user.id} supabase={supabase} selectedId={selectedId} />
```

In the desktop `<Link>` for each campaign row, conditionally add a highlight class:

```tsx
className={`hidden items-center justify-between gap-4 rounded-xl border p-5 transition-colors lg:flex ${
  c.id === selectedId
    ? "border-primary/40 bg-primary/5"
    : "hover:border-primary/40"
}`}
```

- [ ] **Step 2: Compact-mode refinements in `CampaignDetail`**

Audit the `CampaignDetail` output in compact mode. Key adjustments already in Task 1:
- Title: `text-lg` instead of `text-2xl`
- Budget: `text-lg` instead of `text-2xl`
- Description: `text-sm` instead of `text-[15px]`, drop `max-w-prose`
- No back-link
- No "Use as template" link

Additional compact tweaks:
- OwnerPanel/CreatorPanel: reduce `mt-10` to `mt-6` in compact mode
- Edit form max-width can stay as-is (the pane constrains it naturally)

- [ ] **Step 3: Verify visual result**

At lg+ with a campaign selected, the list should show the selected row highlighted and the detail pane should fit cleanly in the 28rem aside without overflow or awkward truncation.

- [ ] **Step 4: Commit**

```bash
git add app/campaigns/page.tsx components/campaigns/campaign-detail.tsx
git commit -m "feat: highlight selected campaign row and compact-mode polish"
```

---

### Task 6: Smoke test full flow

Not a code task — a manual QA pass.

- [ ] **Step 1: Brand flow on desktop (lg+)**
  - Navigate to `/campaigns` — list renders
  - Click a campaign — URL becomes `/campaigns?c={id}`, side pane shows detail
  - Click a different campaign — pane updates
  - Close/reopen campaign from pane — redirects stay on list page
  - Accept/decline a proposal from pane — redirects stay on list page (accept goes to deal)
  - Edit campaign from pane — save redirects back
  - Create new campaign via template picker — redirects to `/campaigns/{id}` (full page, correct)

- [ ] **Step 2: Creator flow on desktop (lg+)**
  - Navigate to `/campaigns` — open campaigns listed
  - Click a campaign — pane shows detail with application form
  - Apply from pane — redirect stays on list page
  - Withdraw from pane — redirect stays on list page

- [ ] **Step 3: Mobile flow (< lg)**
  - Click a campaign — navigates to `/campaigns/{id}` (full page)
  - All actions work as before with back link to `/campaigns`

- [ ] **Step 4: Edge cases**
  - `/campaigns?c=nonexistent-id` — pane should 404 gracefully (or not show)
  - Filters + selection: `/campaigns?status=open&c={id}` — filters persist, pane shows
  - Direct URL `/campaigns/{id}` still works independently
