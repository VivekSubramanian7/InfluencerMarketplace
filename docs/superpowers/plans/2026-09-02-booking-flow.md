# Booking Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce booking friction and prevent mistakes — warn on duplicate bookings, improve the brief form with smart defaults, and add a confirmation step before committing.

**Architecture:** Three tasks modifying one page and adding two small client components. Tasks are independent and can be implemented in any order. No schema changes, no new dependencies.

**Tech Stack:** Next.js (App Router, Server Components), Supabase, Tailwind CSS, shadcn/ui

**Spec:** Bounded design approved in chat on 2026-09-02 (no separate spec file — three changes to existing booking page).

## Global Constraints

- **Design system:** Follow `DESIGN.md` — Gallery Frame. Ink pills for primary actions, outlined pills for secondary. Cards use `rounded-2xl bg-card p-6 shadow-card`. Amber only for trust/attention states.
- **No new dependencies.** All changes use existing components and patterns.
- **No schema changes.**
- **Server Components by default.** Client components only where interactivity requires it.

---

### Task 1: Duplicate Booking Guard

**Files:**
- Modify: `app/book/[offeringId]/page.tsx:30-41` (add deals query to parallel fetch)
- Modify: `app/book/[offeringId]/page.tsx:79-88` (render warning banners)

**Interfaces:**
- Consumes: `deals` table (active deals between brand and creator for this offering; total deal count with this creator).
- Produces: Warning banners. No new exports.

- [ ] **Step 1: Add deal history queries to the parallel fetch**

In `app/book/[offeringId]/page.tsx`, extend the existing `Promise.all` block (lines 30-41):

Current:
```tsx
const [{ data: creator }, { data: brandProducts }] = await Promise.all([
  supabase
    .from("creator_profiles")
    .select("handle")
    .eq("user_id", offering.creator_id)
    .maybeSingle(),
  supabase
    .from("brand_products")
    .select("name, description")
    .eq("brand_id", user!.id)
    .limit(3),
]);
```

New:
```tsx
const [{ data: creator }, { data: brandProducts }, { data: activeDeal }, pastDealCount] =
  await Promise.all([
    supabase
      .from("creator_profiles")
      .select("handle")
      .eq("user_id", offering.creator_id)
      .maybeSingle(),
    supabase
      .from("brand_products")
      .select("name, description")
      .eq("brand_id", user!.id)
      .limit(3),
    supabase
      .from("deals")
      .select("id, status, offering_title")
      .eq("brand_id", user!.id)
      .eq("creator_id", offering.creator_id)
      .eq("offering_id", offering.id)
      .not("status", "in", '("completed","cancelled")')
      .limit(1)
      .maybeSingle(),
    supabase
      .from("deals")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", user!.id)
      .eq("creator_id", offering.creator_id),
  ]);
const previousDeals = pastDealCount.count ?? 0;
```

Two queries added:
- `activeDeal`: finds an active (non-completed, non-cancelled) deal for this exact offering between this brand and creator. Uses `.maybeSingle()` since at most one should exist in practice.
- `pastDealCount`: count-only head query for all deals between this brand and creator (any offering, any status). Fast.

- [ ] **Step 2: Render warning banners**

In `app/book/[offeringId]/page.tsx`, after the payment info banner (line 83, the amber `<p>` tag) and before the error message, add:

```tsx
{activeDeal && (
  <p className="mt-4 rounded-lg border border-amber bg-amber/15 px-4 py-3 text-sm">
    You already have an active deal for this offering ({activeDeal.offering_title} —{" "}
    <Link
      href={`/deals/${activeDeal.id}`}
      className="font-medium underline underline-offset-2"
    >
      view deal
    </Link>
    ). You can still book again if this is a separate project.
  </p>
)}
{!activeDeal && previousDeals > 0 && (
  <p className="mt-4 text-sm text-muted-foreground">
    {previousDeals} previous deal{previousDeals !== 1 ? "s" : ""} with this creator.
  </p>
)}
```

Add the `Link` import if not already present (it isn't — the current file uses `<a>` tags):

```tsx
import Link from "next/link";
```

Design notes:
- Active duplicate uses amber warning style (same as payment banner) — warns but doesn't block.
- Past deal count is a subtle muted note for context, only shown when there's no active duplicate (to avoid clutter).

- [ ] **Step 3: Test in browser**

1. Navigate to `/book/{offeringId}` for an offering where you have NO active deals with that creator.
2. Verify no warning banner appears.
3. If you have past completed deals with this creator, verify "N previous deals" note appears.
4. Create a booking (don't complete/cancel it), then navigate back to `/book/{offeringId}` for the same offering.
5. Verify amber warning appears: "You already have an active deal for this offering" with link to the deal.
6. Click the deal link → navigates to the deal page.
7. Verify you can still submit the form (warning, not blocker).

- [ ] **Step 4: Commit**

```bash
git add app/book/[offeringId]/page.tsx
git commit -m "feat: warn on duplicate bookings and show deal history"
```

---

### Task 2: Brief Form Improvements

**Files:**
- Modify: `app/book/[offeringId]/page.tsx:30-41` (add brand profile query for outreach_template)
- Modify: `app/book/[offeringId]/page.tsx:90-107` (add placeholders, pre-fill talking points)
- Create: `components/book/char-count-textarea.tsx` (client component for character count)

**Interfaces:**
- Consumes: `brand_profiles.outreach_template` for pre-filling talking points.
- Produces: `CharCountTextarea` client component. No other new exports.

- [ ] **Step 1: Add brand profile query for outreach template**

In `app/book/[offeringId]/page.tsx`, add a query for the brand's outreach template to the `Promise.all` block. Extend the destructure:

After the existing queries in `Promise.all`, add:

```tsx
supabase
  .from("brand_profiles")
  .select("outreach_template")
  .eq("user_id", user!.id)
  .maybeSingle(),
```

Update the destructure to include the result:

```tsx
const [{ data: creator }, { data: brandProducts }, { data: activeDeal }, pastDealCount, { data: brandProfile }] =
  await Promise.all([
    // ... existing queries ...
    supabase
      .from("brand_profiles")
      .select("outreach_template")
      .eq("user_id", user!.id)
      .maybeSingle(),
  ]);
```

Note: If Task 1 has already been implemented, the destructure already includes `activeDeal` and `pastDealCount`. Append the brand profile query to the same `Promise.all`.

- [ ] **Step 2: Create CharCountTextarea client component**

Create `components/book/char-count-textarea.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";

export function CharCountTextarea({
  id,
  name,
  rows,
  maxLength,
  defaultValue,
  placeholder,
  required,
}: {
  id: string;
  name: string;
  rows: number;
  maxLength: number;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [length, setLength] = useState(defaultValue?.length ?? 0);

  return (
    <div>
      <Textarea
        id={id}
        name={name}
        rows={rows}
        maxLength={maxLength}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        onChange={(e) => setLength(e.target.value.length)}
      />
      <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">
        {length} / {maxLength}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Update the brief form fields**

In `app/book/[offeringId]/page.tsx`, replace the three form fields (lines 92-103) with improved versions:

Import the new component:
```tsx
import { CharCountTextarea } from "@/components/book/char-count-textarea";
```

Replace the goals field:
```tsx
<div className="flex flex-col gap-1.5">
  <Label htmlFor="goals">What does success look like?</Label>
  <CharCountTextarea
    id="goals"
    name="goals"
    rows={4}
    maxLength={2000}
    required
    placeholder="e.g., 50K views in 2 weeks, drive traffic to our landing page, increase brand awareness with Gen Z audience"
  />
</div>
```

Replace the product description field:
```tsx
<div className="flex flex-col gap-1.5">
  <Label htmlFor="product_description">Product / service description</Label>
  <CharCountTextarea
    id="product_description"
    name="product_description"
    rows={3}
    maxLength={2000}
    defaultValue={productDefault}
    placeholder="e.g., Mobile app for meal planning, targets busy professionals aged 25-40"
  />
</div>
```

Replace the talking points field:
```tsx
<div className="flex flex-col gap-1.5">
  <Label htmlFor="talking_points">Key talking points</Label>
  <CharCountTextarea
    id="talking_points"
    name="talking_points"
    rows={3}
    maxLength={2000}
    defaultValue={brandProfile?.outreach_template ?? ""}
    placeholder="e.g., Mention our free trial, show the app in use, include a call-to-action with our link"
  />
</div>
```

Changes:
- All textareas now show character counts ("42 / 2000").
- "Goals" and "Talking points" have example placeholders.
- "Talking points" pre-fills from the brand's outreach template (if set) — a reasonable default since the outreach template captures the brand's key messaging.
- "Product description" keeps its existing pre-fill from brand products.

- [ ] **Step 4: Test in browser**

1. Navigate to `/book/{offeringId}`.
2. Verify all three textareas show placeholder text when empty.
3. Verify character counts appear below each textarea ("0 / 2000").
4. Type in each field → character count updates in real time.
5. If the brand has an outreach template, verify "Talking points" is pre-filled with it.
6. If the brand has products, verify "Product description" is pre-filled.
7. Verify the form still submits correctly with the new components.

- [ ] **Step 5: Commit**

```bash
git add components/book/char-count-textarea.tsx app/book/[offeringId]/page.tsx
git commit -m "feat: add placeholders, smart defaults, and character counts to booking brief"
```

---

### Task 3: Confirmation Step Before Submit

**Files:**
- Create: `components/book/booking-confirm-button.tsx` (client component with confirmation dialog)
- Modify: `app/book/[offeringId]/page.tsx:90-107` (wrap form with confirmation, pass offering details)

**Interfaces:**
- Consumes: Offering title, price, creator handle (passed as props for the confirmation summary).
- Produces: `BookingConfirmButton` client component that replaces the plain submit button.

- [ ] **Step 1: Create the BookingConfirmButton client component**

Create `components/book/booking-confirm-button.tsx`:

```tsx
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";

export function BookingConfirmButton({
  offeringTitle,
  price,
  creatorHandle,
}: {
  offeringTitle: string;
  price: string;
  creatorHandle: string | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  if (!confirming) {
    return (
      <Button
        type="button"
        className="mt-2"
        onClick={() => setConfirming(true)}
      >
        Send booking request · ${price}
      </Button>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-amber bg-amber/10 p-4">
      <p className="text-sm font-bold">Confirm your booking</p>
      <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
        <li><span className="font-medium text-foreground">{offeringTitle}</span>{creatorHandle ? ` by @${creatorHandle}` : ""}</li>
        <li>Price: <span className="font-bold text-foreground">${price}</span></li>
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        This sends a booking request to the creator. Payment is handled outside the platform.
      </p>
      <div className="mt-3 flex gap-2">
        <Button type="submit">
          Confirm booking
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setConfirming(false)}
        >
          Go back
        </Button>
      </div>
    </div>
  );
}
```

Design notes:
- First click shows a confirmation panel (inline, not a modal — stays in context of the form).
- Summary shows offering title, creator handle, and price.
- "Confirm booking" is the real `type="submit"` that triggers the form action.
- "Go back" collapses back to the single button.
- Amber border matches the trust/attention pattern from the design system.

- [ ] **Step 2: Replace the submit button in the form**

In `app/book/[offeringId]/page.tsx`, import the component:

```tsx
import { BookingConfirmButton } from "@/components/book/booking-confirm-button";
```

Replace the submit button (line 104-106):

Current:
```tsx
<Button type="submit" className="mt-2">
  Send booking request · ${(offering.price_cents / 100).toFixed(0)}
</Button>
```

New:
```tsx
<BookingConfirmButton
  offeringTitle={offering.title}
  price={(offering.price_cents / 100).toFixed(0)}
  creatorHandle={creator?.handle ?? null}
/>
```

- [ ] **Step 3: Test in browser**

1. Navigate to `/book/{offeringId}` and fill in the brief form.
2. Click "Send booking request" → confirmation panel appears inline (form does NOT submit).
3. Verify the confirmation shows: offering title, creator @handle, price.
4. Click "Go back" → confirmation collapses, form fields are preserved.
5. Click "Send booking request" again → confirmation reappears.
6. Click "Confirm booking" → form submits, deal is created, redirects to deal page.
7. Verify on mobile viewport — confirmation panel renders cleanly.
8. Verify that the form validation still fires (e.g., leaving "goals" empty and clicking "Send booking request" → "Confirm booking" → browser validation prevents submit).

Note on validation: Since the first click is `type="button"`, browser validation fires only on the second click ("Confirm booking" which is `type="submit"`). This means the user sees the confirmation panel even with empty fields, but can't actually submit without filling required fields. This is acceptable — the confirmation step is about intent, not validation.

- [ ] **Step 4: Commit**

```bash
git add components/book/booking-confirm-button.tsx app/book/[offeringId]/page.tsx
git commit -m "feat: add confirmation step before booking submission"
```

---

### Task Order

Tasks are independent — they modify different parts of the same page and can be done in any order. If implementing all three:

1. **Task 1** (duplicate guard) adds queries to `Promise.all` and warning banners.
2. **Task 2** (form improvements) adds another query to the same `Promise.all` and replaces form fields.
3. **Task 3** (confirmation) replaces the submit button.

When combining Tasks 1 and 2, merge their `Promise.all` additions into a single block.
