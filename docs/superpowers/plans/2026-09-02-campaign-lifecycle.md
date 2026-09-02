# Campaign Lifecycle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let brands edit open campaigns, clone past campaigns, see full application stats, provide decline reasons, and bulk-manage applications.

**Architecture:** Five independent changes (A–E). One migration adds `decline_reason` to `campaign_applications` and updates the trigger+grants. The rest are server actions and UI. Each task ships independently.

**Tech Stack:** Next.js (App Router, Server Components), Supabase (Postgres, RLS), Tailwind CSS, shadcn/ui

**Spec:** Bounded design approved in chat on 2026-09-02 (no separate spec file).

## Global Constraints

- **Design system:** Follow `DESIGN.md` — Gallery Frame. Ink pills for primary actions, outlined pills for secondary. Cards use `rounded-2xl bg-card shadow-card`. Amber only for trust/attention states.
- **No new dependencies.**
- **One migration:** `0021_campaign_decline_reason.sql` — adds nullable `decline_reason` column, updates trigger and grants.
- **Server Components by default.** Client components only where interactivity requires it.
- **RLS enforced.** The existing update policy on `campaigns` already allows brands to update their own campaigns. The `campaign_applications` update policy and trigger enforce the brand can only change status (not pitch/price).

---

### Task 1: Edit Open Campaigns

**Files:**
- Create: `app/campaigns/[id]/edit-campaign-form.tsx` (client component — inline edit toggle)
- Modify: `app/campaigns/actions.ts` (add `editCampaign` server action)
- Modify: `app/campaigns/[id]/page.tsx:68-78` (add edit button + form to OwnerPanel header area)

**Interfaces:**
- Consumes: `editCampaign` server action, campaign data from page query
- Produces: `EditCampaignForm` client component. Props: `{ campaign: { id, title, description, budget_min_cents, budget_max_cents, apply_by } }`

- [ ] **Step 1: Add editCampaign server action**

In `app/campaigns/actions.ts`, add after the `setCampaignStatus` function:

```tsx
export async function editCampaign(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();
  const id = String(formData.get("id") ?? "");

  const title = parseText(String(formData.get("title") ?? ""), 80);
  const description = parseText(String(formData.get("description") ?? ""), 2000);
  const budgetMin = parsePriceCents(String(formData.get("budget_min") ?? ""));
  const budgetMax = parsePriceCents(String(formData.get("budget_max") ?? ""));
  const applyBy = parseApplyBy(String(formData.get("apply_by") ?? ""));

  if (!title || !description || !budgetMin || !budgetMax || budgetMax < budgetMin || !applyBy.ok) {
    redirect(`/campaigns/${id}?error=` + encodeURIComponent(
      "Check the form: title (≤80), description (≤2000), budget $1–$1,000,000 with max ≥ min, and a valid date"));
  }

  const { error } = await supabase
    .from("campaigns")
    .update({
      title,
      description,
      budget_min_cents: budgetMin,
      budget_max_cents: budgetMax,
      apply_by: applyBy.value,
    })
    .eq("id", id)
    .eq("brand_id", user.id);

  if (error) {
    redirect(`/campaigns/${id}?error=` + encodeURIComponent(friendlyDbError(error)));
  }
  redirect(`/campaigns/${id}?saved=1`);
}
```

Note: `offering_type` is intentionally not editable — changing it after creators applied would invalidate their proposals. The existing column-level grant in `0014_campaigns.sql` (line 162) already permits updates on `title, description, budget_min_cents, budget_max_cents, apply_by, status`.

Also add the `parseApplyBy` helper and `friendlyDbError` import to the file. Currently `parseApplyBy` is defined locally in this file but `friendlyDbError` is not imported. Add:

```tsx
import { friendlyDbError } from "@/lib/errors";
```

- [ ] **Step 2: Create the inline edit form component**

Create `app/campaigns/[id]/edit-campaign-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { editCampaign } from "../actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function EditCampaignForm({
  campaign,
}: {
  campaign: {
    id: string;
    title: string;
    description: string;
    budget_min_cents: number;
    budget_max_cents: number;
    apply_by: string | null;
  };
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
        Edit campaign
      </Button>
    );
  }

  return (
    <form action={editCampaign} className="mt-4 flex max-w-xl flex-col gap-4 rounded-xl border p-5">
      <input type="hidden" name="id" value={campaign.id} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-title">Title</Label>
        <Input id="edit-title" name="title" required maxLength={80} defaultValue={campaign.title} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-description">Description</Label>
        <Textarea
          id="edit-description"
          name="description"
          rows={5}
          required
          maxLength={2000}
          defaultValue={campaign.description}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-budget-min">Budget from (USD)</Label>
          <Input
            id="edit-budget-min"
            name="budget_min"
            inputMode="decimal"
            required
            defaultValue={(campaign.budget_min_cents / 100).toFixed(2)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-budget-max">Budget to (USD)</Label>
          <Input
            id="edit-budget-max"
            name="budget_max"
            inputMode="decimal"
            required
            defaultValue={(campaign.budget_max_cents / 100).toFixed(2)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-apply-by">Applications close</Label>
        <Input
          id="edit-apply-by"
          name="apply_by"
          type="date"
          defaultValue={campaign.apply_by ?? ""}
        />
      </div>
      <div className="flex gap-2">
        <SubmitButton size="sm" pendingLabel="Saving…">Save changes</SubmitButton>
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Wire the edit form into the campaign detail page**

In `app/campaigns/[id]/page.tsx`, add the import at the top:

```tsx
import { EditCampaignForm } from "./edit-campaign-form";
```

Update the campaign query (line 45-49) to also select `description`:

```tsx
const { data: campaign } = await supabase
  .from("campaigns")
  .select("id, brand_id, title, description, offering_type, budget_min_cents, budget_max_cents, apply_by, status, created_at")
  .eq("id", id)
  .maybeSingle();
```

(Note: `description` is already in the select — verify this. It is: line 47.)

In the OwnerPanel component, add the edit form after the Close/Reopen button area. After the `</form>` that wraps the close/reopen button (line 153), add:

```tsx
{status === "open" && (
  <EditCampaignForm
    campaign={{
      id: campaignId,
      title,
      description,
      budget_min_cents: budgetMinCents,
      budget_max_cents: budgetMaxCents,
      apply_by: applyBy,
    }}
  />
)}
```

The OwnerPanel needs to receive these additional props. Update the OwnerPanel signature and call site:

In the `OwnerPanel` function signature (line 113), add the needed props:

```tsx
async function OwnerPanel({
  campaignId,
  status,
  title,
  description,
  budgetMinCents,
  budgetMaxCents,
  applyBy,
  supabase,
}: {
  campaignId: string;
  status: string;
  title: string;
  description: string;
  budgetMinCents: number;
  budgetMaxCents: number;
  applyBy: string | null;
  supabase: Supabase;
}) {
```

Update the call site (line 97):

```tsx
<OwnerPanel
  campaignId={campaign.id}
  status={campaign.status}
  title={campaign.title}
  description={campaign.description}
  budgetMinCents={campaign.budget_min_cents}
  budgetMaxCents={campaign.budget_max_cents}
  applyBy={campaign.apply_by}
  supabase={supabase}
/>
```

- [ ] **Step 4: Test in browser**

1. Navigate to an open campaign you own → "Edit campaign" button visible.
2. Click Edit → inline form appears with current values pre-filled.
3. Change title and budget → save → page reloads with updated values.
4. Cancel → form hides, no changes.
5. Navigate to a closed campaign → "Edit campaign" button NOT visible.
6. Verify creator view is unchanged (no edit button).
7. Try editing with invalid budget (max < min) → error message appears.

- [ ] **Step 5: Commit**

```bash
git add app/campaigns/actions.ts app/campaigns/[id]/edit-campaign-form.tsx app/campaigns/[id]/page.tsx
git commit -m "feat: let brands edit open campaigns (title, description, budget, deadline)"
```

---

### Task 2: Clone Campaign

**Files:**
- Modify: `app/campaigns/[id]/page.tsx` (add "Use as template" link)
- Modify: `app/campaigns/page.tsx:31-38` (read `clone` search param, fetch source campaign)
- Modify: `app/campaigns/page.tsx:133-180` (pre-fill the creation form from clone data)

**Interfaces:**
- Consumes: `searchParams.clone` (campaign ID), campaign data from Supabase query
- Produces: Pre-filled campaign creation form. No new server actions — reuses `createCampaign`.

- [ ] **Step 1: Add "Use as template" link to campaign detail page**

In `app/campaigns/[id]/page.tsx`, inside the campaign detail page (after the description paragraph, around line 93), add a link visible to the owner:

```tsx
{isOwner && (
  <Link
    href={`/campaigns?clone=${campaign.id}`}
    className="mt-4 inline-block text-sm font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
  >
    Use as template →
  </Link>
)}
```

- [ ] **Step 2: Read clone param and fetch source campaign**

In `app/campaigns/page.tsx`, update the `searchParams` type (line 33-34):

```tsx
searchParams: Promise<{ error?: string; saved?: string; clone?: string }>;
```

Update the destructuring (line 37):

```tsx
const { error, saved, clone } = await searchParams;
```

Pass `clone` to `BrandCampaigns` (line 63):

```tsx
<BrandCampaigns userId={user.id} supabase={supabase} cloneId={clone} />
```

Update the `BrandCampaigns` function signature (line 74):

```tsx
async function BrandCampaigns({ userId, supabase, cloneId }: { userId: string; supabase: Supabase; cloneId?: string }) {
```

After the existing queries (line 94), add:

```tsx
let cloneData: { title: string; description: string; offering_type: string; budget_min_cents: number; budget_max_cents: number } | null = null;
if (cloneId) {
  const { data } = await supabase
    .from("campaigns")
    .select("title, description, offering_type, budget_min_cents, budget_max_cents")
    .eq("id", cloneId)
    .eq("brand_id", userId)
    .maybeSingle();
  cloneData = data;
}
```

- [ ] **Step 3: Pre-fill the creation form**

In `app/campaigns/page.tsx`, update the campaign creation form (lines 132-180) to use `cloneData` for default values. Replace the heading and form:

```tsx
<h2 className="text-lg font-bold">{cloneData ? "Clone campaign" : "Start a campaign"}</h2>
<form action={createCampaign} className="mt-3 flex max-w-xl flex-col gap-4">
  <div className="flex flex-col gap-1.5">
    <Label htmlFor="title">Title</Label>
    <Input
      id="title"
      name="title"
      required
      defaultValue={cloneData?.title ?? ""}
      placeholder="Spring launch, honest review videos"
    />
  </div>
  <div className="flex flex-col gap-1.5">
    <Label htmlFor="description">What you&apos;re looking for</Label>
    <Textarea
      id="description"
      name="description"
      rows={5}
      required
      defaultValue={cloneData?.description ?? ""}
      placeholder="The product, the audience you want to reach, and what a great video looks like to you."
    />
  </div>
  <div className="flex flex-col gap-1.5">
    <Label htmlFor="type">Content type</Label>
    <select
      id="type"
      name="type"
      className="h-10 rounded-lg border bg-background px-3 text-sm"
      defaultValue={cloneData?.offering_type ?? "dedicated_video"}
    >
      {Object.entries(TYPE_LABELS).map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  </div>
  <div className="grid grid-cols-2 gap-4">
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="budget_min">Budget from (USD)</Label>
      <Input
        id="budget_min"
        name="budget_min"
        inputMode="decimal"
        required
        defaultValue={cloneData ? (cloneData.budget_min_cents / 100).toFixed(2) : ""}
      />
    </div>
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="budget_max">Budget to (USD)</Label>
      <Input
        id="budget_max"
        name="budget_max"
        inputMode="decimal"
        required
        defaultValue={cloneData ? (cloneData.budget_max_cents / 100).toFixed(2) : ""}
      />
    </div>
  </div>
  <div className="flex flex-col gap-1.5">
    <Label htmlFor="apply_by">Applications close (optional)</Label>
    <Input id="apply_by" name="apply_by" type="date" />
  </div>
  <Button type="submit" className="mt-2">
    {cloneData ? "Create from template" : "Start campaign"}
  </Button>
</form>
```

Note: `apply_by` is intentionally NOT pre-filled from clone — deadlines should always be fresh.

- [ ] **Step 4: Test in browser**

1. Navigate to any campaign you own → "Use as template →" link visible below description.
2. Click it → goes to `/campaigns?clone={id}`, creation form pre-filled with title, description, type, budget.
3. Apply-by date is blank (not cloned).
4. Heading shows "Clone campaign" and button says "Create from template".
5. Submit → new campaign created, redirected to its detail page.
6. Verify the original campaign is unchanged.
7. Without `clone` param → form is blank as before, heading "Start a campaign".
8. With invalid/non-owned clone ID → form renders blank (graceful fallback, `cloneData` is null).

- [ ] **Step 5: Commit**

```bash
git add app/campaigns/page.tsx app/campaigns/[id]/page.tsx
git commit -m "feat: let brands clone campaigns as templates"
```

---

### Task 3: Application Stats on List Page

**Files:**
- Modify: `app/campaigns/page.tsx:82-94` (group applications by status instead of just counting pending)

**Interfaces:**
- Consumes: Existing `campaign_applications` query
- Produces: Updated campaign cards showing breakdown by status

- [ ] **Step 1: Group applications by status**

In `app/campaigns/page.tsx`, replace the pending counting logic (lines 82-94):

Current:
```tsx
const ids = (campaigns ?? []).map((c) => c.id);
const pendingByCampaign = new Map<string, number>();
if (ids.length > 0) {
  const { data: apps, error: aErr } = await supabase
    .from("campaign_applications")
    .select("campaign_id, status")
    .in("campaign_id", ids);
  if (aErr) throw new Error("applications query failed: " + aErr.message);
  for (const a of apps ?? []) {
    if (a.status !== "pending") continue;
    pendingByCampaign.set(a.campaign_id, (pendingByCampaign.get(a.campaign_id) ?? 0) + 1);
  }
}
```

Replace with:
```tsx
const ids = (campaigns ?? []).map((c) => c.id);
type Stats = { pending: number; accepted: number; declined: number };
const statsByCampaign = new Map<string, Stats>();
if (ids.length > 0) {
  const { data: apps, error: aErr } = await supabase
    .from("campaign_applications")
    .select("campaign_id, status")
    .in("campaign_id", ids);
  if (aErr) throw new Error("applications query failed: " + aErr.message);
  for (const a of apps ?? []) {
    if (a.status === "withdrawn") continue;
    const s = statsByCampaign.get(a.campaign_id) ?? { pending: 0, accepted: 0, declined: 0 };
    if (a.status === "pending") s.pending++;
    else if (a.status === "accepted") s.accepted++;
    else if (a.status === "declined") s.declined++;
    statsByCampaign.set(a.campaign_id, s);
  }
}
```

- [ ] **Step 2: Update the campaign card rendering**

In the campaign list rendering (lines 99-123), replace the `pending` variable and badge:

Replace:
```tsx
const pending = pendingByCampaign.get(c.id) ?? 0;
```

With:
```tsx
const stats = statsByCampaign.get(c.id);
```

Replace the badge area (lines 114-119):
```tsx
<span className="flex shrink-0 items-center gap-4">
  {pending > 0 && <Badge>{pending} pending</Badge>}
  <Badge variant="secondary">{c.status}</Badge>
  <span className="font-extrabold tabular-nums text-primary">
    {budgetRange(c.budget_min_cents, c.budget_max_cents)}
  </span>
</span>
```

With:
```tsx
<span className="flex shrink-0 items-center gap-4">
  {stats && (stats.pending > 0 || stats.accepted > 0 || stats.declined > 0) && (
    <span className="text-xs text-muted-foreground tabular-nums">
      {[
        stats.pending > 0 && `${stats.pending} pending`,
        stats.accepted > 0 && `${stats.accepted} accepted`,
        stats.declined > 0 && `${stats.declined} declined`,
      ].filter(Boolean).join(" · ")}
    </span>
  )}
  <Badge variant="secondary">{c.status}</Badge>
  <span className="font-extrabold tabular-nums text-primary">
    {budgetRange(c.budget_min_cents, c.budget_max_cents)}
  </span>
</span>
```

- [ ] **Step 3: Test in browser**

1. Navigate to `/campaigns` as a brand with campaigns that have applications.
2. Campaign cards show breakdown: "3 pending · 1 accepted" etc.
3. Campaigns with zero (non-withdrawn) applications show no stats text.
4. Withdrawn applications are excluded from counts.
5. Verify creator view is unchanged.

- [ ] **Step 4: Commit**

```bash
git add app/campaigns/page.tsx
git commit -m "feat: show application breakdown (pending/accepted/declined) on campaign list"
```

---

### Task 4: Decline Reasons

**Files:**
- Create: `supabase/migrations/0021_campaign_decline_reason.sql`
- Modify: `app/campaigns/[id]/actions.ts:74-124` (accept decline_reason in `decideApplication`)
- Modify: `app/campaigns/[id]/page.tsx:180-194` (add textarea to decline form, show reason in creator view)

**Interfaces:**
- Consumes: New `decline_reason` column on `campaign_applications`
- Produces: Updated decline form with optional reason field; creator sees reason when declined

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0021_campaign_decline_reason.sql`:

```sql
-- Add optional decline reason so brands can give feedback on rejected applications.
-- The trigger must also allow brands to set this column during the decline transition.

alter table public.campaign_applications
  add column decline_reason text check (decline_reason is null or length(decline_reason) <= 500);

-- Rebuild the update trigger to allow brands to set decline_reason when declining.
-- The old trigger checks pitch and price immutability for brands, but doesn't know
-- about decline_reason. Replace it to also permit decline_reason changes by the brand.
create or replace function public.validate_campaign_application_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_brand uuid;
begin
  if v_uid is null then
    return new;
  end if;

  if new.campaign_id <> old.campaign_id
     or new.creator_id <> old.creator_id
     or new.created_at <> old.created_at then
    raise exception 'Application identity cannot change';
  end if;

  select brand_id into v_brand from public.campaigns c where c.id = old.campaign_id;

  if v_uid = old.creator_id then
    if old.status <> 'pending' then
      raise exception 'Only pending applications can be changed';
    end if;
    if new.status not in ('pending','withdrawn') then
      raise exception 'Creators can only withdraw an application';
    end if;
  elsif v_uid = v_brand then
    if new.pitch <> old.pitch
       or new.proposed_price_cents <> old.proposed_price_cents then
      raise exception 'Brands cannot edit an application';
    end if;
    if old.status <> 'pending' or new.status not in ('accepted','declined') then
      raise exception 'Only pending applications can be accepted or declined';
    end if;
    -- decline_reason is allowed to change when declining (or be set to null on accept)
  else
    raise exception 'Not allowed';
  end if;

  return new;
end;
$$;

-- Extend the column-level grant to include decline_reason
grant update (pitch, proposed_price_cents, status, decline_reason)
  on table public.campaign_applications to authenticated;
```

- [ ] **Step 2: Update the decideApplication action to accept decline_reason**

In `app/campaigns/[id]/actions.ts`, update the decline branch (lines 108-123).

Replace:
```tsx
const { data: declined, error } = await supabase
  .from("campaign_applications")
  .update({ status: "declined" })
  .eq("id", id)
  .select("creator_id")
  .maybeSingle();
```

With:
```tsx
const reasonRaw = String(formData.get("decline_reason") ?? "").trim();
const declineReason = reasonRaw.length > 0 ? reasonRaw.slice(0, 500) : null;

const { data: declined, error } = await supabase
  .from("campaign_applications")
  .update({ status: "declined", decline_reason: declineReason })
  .eq("id", id)
  .select("creator_id")
  .maybeSingle();
```

- [ ] **Step 3: Add decline reason textarea to the decline form in OwnerPanel**

In `app/campaigns/[id]/page.tsx`, in the OwnerPanel where pending applications show Accept/Decline buttons (lines 181-195), replace the decline form:

Current:
```tsx
<form action={decideApplication}>
  <input type="hidden" name="campaign_id" value={campaignId} />
  <input type="hidden" name="id" value={a.id} />
  <input type="hidden" name="decision" value="declined" />
  <Button type="submit" variant="outline" size="sm">Decline</Button>
</form>
```

Replace with:
```tsx
<details className="group">
  <summary className="cursor-pointer">
    <Button type="button" variant="outline" size="sm" asChild>
      <span>Decline</span>
    </Button>
  </summary>
  <form action={decideApplication} className="mt-2 flex flex-col gap-2">
    <input type="hidden" name="campaign_id" value={campaignId} />
    <input type="hidden" name="id" value={a.id} />
    <input type="hidden" name="decision" value="declined" />
    <textarea
      name="decline_reason"
      maxLength={500}
      rows={2}
      placeholder="Brief feedback for the creator (optional)"
      className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
    />
    <Button type="submit" variant="outline" size="sm" className="self-start text-destructive border-destructive/40">
      Confirm decline
    </Button>
  </form>
</details>
```

This uses a `<details>` element so the textarea only appears after clicking "Decline" — keeps the default view clean.

- [ ] **Step 4: Show decline reason in OwnerPanel for declined applications**

In the OwnerPanel, after the status badge area for each application, add display of decline reason for declined apps. After line 179 (`<p className="mt-2 whitespace-pre-wrap text-sm">{a.pitch}</p>`), add:

```tsx
{a.status === "declined" && a.decline_reason && (
  <p className="mt-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
    <span className="font-medium">Feedback:</span> {a.decline_reason}
  </p>
)}
```

Update the applications query (line 123) to include `decline_reason`:

```tsx
.select("id, creator_id, pitch, proposed_price_cents, status, deal_id, decline_reason, created_at")
```

- [ ] **Step 5: Show decline reason to creators**

In the CreatorPanel (around line 242), for the existing application view, add decline reason display. After the status badge:

```tsx
{mine.status === "declined" && mine.decline_reason && (
  <p className="mt-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
    <span className="font-medium">Brand feedback:</span> {mine.decline_reason}
  </p>
)}
```

Update the creator's application query (line 236) to include `decline_reason`:

```tsx
.select("id, pitch, proposed_price_cents, status, deal_id, decline_reason")
```

- [ ] **Step 6: Test in browser**

1. Run the migration: `supabase db push` or `supabase migration up`.
2. As brand owner, view a campaign with pending applications.
3. Click "Decline" → dropdown opens with textarea + "Confirm decline" button.
4. Enter a reason and confirm → application status changes to "Declined", reason shows below the pitch.
5. Decline without a reason → works fine, no reason displayed.
6. As the declined creator, view the campaign → see "Brand feedback: ..." below your application.
7. Accept flow still works (no decline_reason field needed).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0021_campaign_decline_reason.sql app/campaigns/[id]/actions.ts app/campaigns/[id]/page.tsx
git commit -m "feat: add optional decline reasons for campaign applications"
```

---

### Task 5: Bulk Accept/Decline

**Files:**
- Modify: `app/campaigns/[id]/actions.ts` (add `bulkDecideApplications` server action)
- Create: `app/campaigns/[id]/bulk-proposals.tsx` (client component — checkbox selection + bulk actions)
- Modify: `app/campaigns/[id]/page.tsx` (replace inline application list with bulk-capable component)

**Interfaces:**
- Consumes: `bulkDecideApplications` server action, `decideApplication` (for accept which calls RPC)
- Produces: `BulkProposals` client component. Props: `{ campaignId: string; applications: Array<{...}>; handleById: Map; nameById: Map }`

- [ ] **Step 1: Add bulkDecideApplications server action**

In `app/campaigns/[id]/actions.ts`, add after the `decideApplication` function:

```tsx
export async function bulkDecideApplications(formData: FormData) {
  await requireRole("brand");
  const supabase = await createServerSupabase();
  const campaignId = String(formData.get("campaign_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const ids = formData.getAll("application_ids").map(String).filter(Boolean);
  const reasonRaw = String(formData.get("decline_reason") ?? "").trim();
  const declineReason = reasonRaw.length > 0 ? reasonRaw.slice(0, 500) : null;

  if (ids.length === 0 || (decision !== "accepted" && decision !== "declined")) {
    redirect(`/campaigns/${campaignId}`);
  }

  const errors: string[] = [];

  if (decision === "accepted") {
    for (const id of ids) {
      const { error } = await supabase.rpc("accept_campaign_application", {
        p_application_id: id,
      });
      if (error) errors.push(error.message);
      else {
        const { data: app } = await supabase
          .from("campaign_applications").select("creator_id").eq("id", id).maybeSingle();
        if (app) {
          await notify({
            userId: app.creator_id,
            kind: "application_response",
            title: "Your campaign application was accepted — the deal has started",
            href: `/campaigns/${campaignId}`,
            email: true,
          });
        }
      }
    }
  } else {
    for (const id of ids) {
      const { data: declined, error } = await supabase
        .from("campaign_applications")
        .update({ status: "declined", decline_reason: declineReason })
        .eq("id", id)
        .select("creator_id")
        .maybeSingle();
      if (error) errors.push(error.message);
      else if (declined) {
        await notify({
          userId: declined.creator_id,
          kind: "application_response",
          title: "Your campaign application was declined",
          href: `/campaigns/${campaignId}`,
        });
      }
    }
  }

  if (errors.length > 0) {
    redirect(`/campaigns/${campaignId}?error=` +
      encodeURIComponent(`${errors.length} application(s) failed: ${errors[0]}`));
  }
  redirect(`/campaigns/${campaignId}?saved=1`);
}
```

Note: Bulk accept calls the RPC per application (not in a single transaction). This is acceptable — each `accept_campaign_application` is already atomic and idempotent-safe (it checks `status = 'pending'`). Unlike the single-accept flow, bulk accept does NOT redirect to the deal page — it stays on the campaign page.

- [ ] **Step 2: Create the bulk proposals component**

Create `app/campaigns/[id]/bulk-proposals.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { decideApplication, bulkDecideApplications } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const APPLICATION_LABELS: Record<string, string> = {
  pending: "Pending review",
  accepted: "Accepted",
  declined: "Declined",
};

type App = {
  id: string;
  creator_id: string;
  pitch: string;
  proposed_price_cents: number;
  status: string;
  deal_id: string | null;
  decline_reason: string | null;
};

export function BulkProposals({
  campaignId,
  applications,
  nameById,
  handleById,
}: {
  campaignId: string;
  applications: App[];
  nameById: Record<string, string | null>;
  handleById: Record<string, string>;
}) {
  const pending = applications.filter((a) => a.status === "pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === pending.length
        ? new Set()
        : new Set(pending.map((a) => a.id))
    );

  return (
    <div>
      {/* ── Bulk actions bar ── */}
      {pending.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.size === pending.length && pending.length > 0}
              onChange={toggleAll}
              className="size-4 accent-primary"
            />
            Select all pending ({pending.length})
          </label>
          {selected.size > 0 && (
            <>
              <form action={bulkDecideApplications}>
                <input type="hidden" name="campaign_id" value={campaignId} />
                <input type="hidden" name="decision" value="accepted" />
                {[...selected].map((id) => (
                  <input key={id} type="hidden" name="application_ids" value={id} />
                ))}
                <Button type="submit" size="sm">
                  Accept {selected.size}
                </Button>
              </form>
              <details className="group">
                <summary className="cursor-pointer">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span>Decline {selected.size}</span>
                  </Button>
                </summary>
                <form action={bulkDecideApplications} className="mt-2 flex flex-col gap-2">
                  <input type="hidden" name="campaign_id" value={campaignId} />
                  <input type="hidden" name="decision" value="declined" />
                  {[...selected].map((id) => (
                    <input key={id} type="hidden" name="application_ids" value={id} />
                  ))}
                  <textarea
                    name="decline_reason"
                    maxLength={500}
                    rows={2}
                    placeholder="Shared feedback for all declined creators (optional)"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                  />
                  <Button type="submit" variant="outline" size="sm" className="self-start text-destructive border-destructive/40">
                    Confirm decline {selected.size}
                  </Button>
                </form>
              </details>
            </>
          )}
        </div>
      )}

      {/* ── Application list ── */}
      <ul className="flex flex-col gap-3">
        {applications.map((a) => {
          const handle = handleById[a.creator_id];
          const isPending = a.status === "pending";
          return (
            <li key={a.id} className="rounded-xl border p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 font-bold">
                  {isPending && pending.length > 1 && (
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggle(a.id)}
                      className="size-4 accent-primary"
                    />
                  )}
                  {nameById[a.creator_id] || handle || "Creator"}
                  {handle && (
                    <Link
                      href={`/c/${handle}`}
                      className="text-sm font-medium text-muted-foreground underline-offset-2 hover:underline"
                    >
                      @{handle}
                    </Link>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <Badge variant="secondary">{APPLICATION_LABELS[a.status] ?? a.status}</Badge>
                  <span className="font-extrabold tabular-nums text-primary">
                    ${(a.proposed_price_cents / 100).toFixed(2)}
                  </span>
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{a.pitch}</p>
              {a.status === "declined" && a.decline_reason && (
                <p className="mt-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
                  <span className="font-medium">Feedback:</span> {a.decline_reason}
                </p>
              )}
              {isPending && (
                <div className="mt-3 flex gap-2">
                  <form action={decideApplication}>
                    <input type="hidden" name="campaign_id" value={campaignId} />
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="decision" value="accepted" />
                    <Button type="submit" size="sm">Accept</Button>
                  </form>
                  <details className="group">
                    <summary className="cursor-pointer">
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span>Decline</span>
                      </Button>
                    </summary>
                    <form action={decideApplication} className="mt-2 flex flex-col gap-2">
                      <input type="hidden" name="campaign_id" value={campaignId} />
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="decision" value="declined" />
                      <textarea
                        name="decline_reason"
                        maxLength={500}
                        rows={2}
                        placeholder="Brief feedback (optional)"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                      />
                      <Button type="submit" variant="outline" size="sm" className="self-start text-destructive border-destructive/40">
                        Confirm decline
                      </Button>
                    </form>
                  </details>
                </div>
              )}
              {a.status === "accepted" && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {a.deal_id ? (
                    <>
                      Accepted at their proposed price.{" "}
                      <Link href={`/deals/${a.deal_id}`} className="font-medium underline underline-offset-2">
                        open the deal
                      </Link>
                      .
                    </>
                  ) : (
                    "Accepted."
                  )}
                </p>
              )}
            </li>
          );
        })}
        {applications.length === 0 && (
          <li className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No applications yet.
          </li>
        )}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Replace the OwnerPanel application list with BulkProposals**

In `app/campaigns/[id]/page.tsx`, add the import:

```tsx
import { BulkProposals } from "./bulk-proposals";
```

In the OwnerPanel, replace the `<ul>` that renders applications (lines 155-220) with:

```tsx
<BulkProposals
  campaignId={campaignId}
  applications={visible.map((a) => ({
    id: a.id,
    creator_id: a.creator_id,
    pitch: a.pitch,
    proposed_price_cents: a.proposed_price_cents,
    status: a.status,
    deal_id: a.deal_id,
    decline_reason: a.decline_reason,
  }))}
  nameById={Object.fromEntries(nameById)}
  handleById={Object.fromEntries(handleById)}
/>
```

Remove the individual Accept/Decline forms and the inline application rendering that BulkProposals replaces. The OwnerPanel's header (Proposals title + close/reopen + edit form) remains as-is.

- [ ] **Step 4: Test in browser**

1. Campaign with 3+ pending applications → "Select all pending" checkbox + individual checkboxes visible.
2. Select 2 → "Accept 2" and "Decline 2" buttons appear.
3. Click "Accept 2" → both applications accepted, deals created, page reloads.
4. Select remaining, click "Decline" → expand reason textarea → enter shared reason → confirm.
5. All declined with same reason shown.
6. Campaign with 1 pending → no "Select all" bar, only individual Accept/Decline.
7. Campaign with 0 pending → no checkboxes, only accepted/declined apps with their status.
8. Individual Accept/Decline per-row still works as before.
9. Bulk accept with an already-non-pending application in the selection → error message for that one, others succeed.

- [ ] **Step 5: Commit**

```bash
git add app/campaigns/[id]/actions.ts app/campaigns/[id]/bulk-proposals.tsx app/campaigns/[id]/page.tsx
git commit -m "feat: bulk accept/decline campaign applications with optional shared decline reason"
```
