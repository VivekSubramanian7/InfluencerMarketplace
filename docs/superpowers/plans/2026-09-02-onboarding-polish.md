# Onboarding Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break the brand's single-form onboarding into a 3-step guided wizard, and add a getting-started checklist to the dashboard that tracks first-time milestones.

**Architecture:** Task 1 builds a client-side step wizard that wraps the existing form fields — same `saveBrandProfile` server action, no partial saves. Task 2 adds a checklist card to the brand dashboard using data already fetched plus two cheap count queries. Both tasks are independent and can ship separately.

**Tech Stack:** Next.js (App Router, Server Components + one client component), Supabase, Tailwind CSS, shadcn/ui

**Spec:** Bounded design approved in chat on 2026-09-02 (no separate spec file).

## Global Constraints

- **Design system:** Follow `DESIGN.md` — Gallery Frame. Ink pills for primary actions, outlined pills for secondary. Cards use `rounded-2xl bg-card p-6 shadow-card`. Amber only for trust/attention states.
- **No new dependencies.** All changes use existing components and patterns.
- **No schema changes.** No new tables or columns.
- **Server action unchanged.** `saveBrandProfile` in `app/brand/actions.ts` stays as-is — the wizard is purely UI.
- **RLS enforced.** All queries go through the Supabase client.

---

### Task 1: Multi-Step Onboarding Wizard

**Files:**
- Create: `components/brand/onboarding-wizard.tsx` (client component — step state + form)
- Modify: `app/brand/onboarding/page.tsx` (replace inline form with wizard component)

**Interfaces:**
- Consumes: `BrandProfileDefaults` type from `components/brand/brand-profile-form.tsx`, `IngestProposal` type from `lib/brand/ingest.ts`, `saveBrandProfile` action from `app/brand/actions.ts`
- Produces: `OnboardingWizard` component. Props: `{ defaults: BrandProfileDefaults | null; proposal: IngestProposal | null; website: string | null; productsJson: string | null }`

- [ ] **Step 1: Create the wizard client component**

Create `components/brand/onboarding-wizard.tsx`:

```tsx
"use client";

import { useState } from "react";
import { saveBrandProfile } from "@/app/brand/actions";
import { OFFERING_TYPES } from "@/lib/discovery/filters";
import { WebsiteIngest } from "@/components/brand/website-ingest";
import { OtherFormatField } from "@/components/brand/other-format-field";
import { ProposedProducts } from "@/components/brand/proposed-products";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { BrandProfileDefaults } from "@/components/brand/brand-profile-form";
import type { IngestProposal } from "@/lib/brand/ingest";

const TYPE_LABELS: Record<string, string> = {
  dedicated_video: "Dedicated video",
  integration: "Integration (60-90s)",
  short_form_post: "Short-form post",
  ugc_video: "UGC video",
};

const STEPS = [
  { label: "Your brand", number: 1 },
  { label: "Who you work with", number: 2 },
  { label: "Outreach style", number: 3 },
] as const;

export function OnboardingWizard({
  defaults,
  proposal,
  website,
  productsJson,
}: {
  defaults: BrandProfileDefaults | null;
  proposal: IngestProposal | null;
  website: string | null;
  productsJson: string | null;
}) {
  const [step, setStep] = useState(1);

  return (
    <div>
      {/* ── Progress bar ── */}
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>Step {step} of 3 · {STEPS[step - 1].label}</span>
        <span className="tabular-nums">{Math.round((step / 3) * 100)}% complete</span>
      </div>
      <div className="mt-1.5 flex gap-1">
        {STEPS.map((s) => (
          <div
            key={s.number}
            className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
              s.number <= step ? "bg-primary" : "bg-border"
            }`}
          />
        ))}
      </div>

      {/* ── Website ingest (step 1 only, separate form) ── */}
      {step === 1 && (
        <div className="mt-6 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Start with your website</h2>
          <div className="mt-2">
            <WebsiteIngest from="onboarding" website={website} proposal={proposal} />
          </div>
        </div>
      )}

      {/* ── Main form (all fields always present as hidden when not visible) ── */}
      <form action={saveBrandProfile} className="mt-6">
        <input type="hidden" name="from" value="onboarding" />
        {productsJson && step === 2 && <ProposedProducts initial={JSON.parse(productsJson)} />}

        {/* ── Step 1: Brand basics ── */}
        <div className={step === 1 ? "flex flex-col gap-4" : "hidden"}>
          <h2 className="text-lg font-bold">Tell us about your brand</h2>
          <p className="text-sm text-muted-foreground">
            The basics — who you are and what you do.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="company">Company name</Label>
            <Input
              id="company"
              name="company"
              defaultValue={defaults?.company ?? ""}
              placeholder="Acme Skincare"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              name="website"
              type="url"
              defaultValue={defaults?.website ?? ""}
              placeholder="https://acme.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">What your brand is about</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              maxLength={2000}
              defaultValue={defaults?.description ?? ""}
              placeholder="What you sell, who it's for, and the tone you go for."
            />
          </div>
        </div>

        {/* ── Step 2: Creator matching ── */}
        <div className={step === 2 ? "flex flex-col gap-4" : "hidden"}>
          <h2 className="text-lg font-bold">Who do you work with?</h2>
          <p className="text-sm text-muted-foreground">
            Helps us suggest the right creators for your brand.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pref_niches">Content niches (comma-separated, up to 8)</Label>
            <Input
              id="pref_niches"
              name="pref_niches"
              defaultValue={(defaults?.pref_niches ?? []).join(", ")}
              placeholder="beauty, fitness, food"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Formats</span>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {OFFERING_TYPES.map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="pref_types"
                    value={t}
                    defaultChecked={(defaults?.pref_types ?? []).includes(t)}
                    className="size-4 accent-primary"
                  />
                  {TYPE_LABELS[t]}
                </label>
              ))}
            </div>
            <OtherFormatField defaultValue={defaults?.pref_types_other ?? ""} />
          </div>
        </div>

        {/* ── Step 3: Outreach & docs ── */}
        <div className={step === 3 ? "flex flex-col gap-4" : "hidden"}>
          <h2 className="text-lg font-bold">Your outreach style</h2>
          <p className="text-sm text-muted-foreground">
            Your default message and any documents creators should have.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="outreach_template">Message template</Label>
            <Textarea
              id="outreach_template"
              name="outreach_template"
              rows={3}
              maxLength={2000}
              defaultValue={defaults?.outreach_template ?? ""}
              placeholder="Hi! We love your work and would like to collaborate on…"
            />
            <p className="text-xs text-muted-foreground">
              Sent when you reach out to creators from Discover.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="guidelines">Brand guidelines</Label>
              <input
                id="guidelines"
                name="guidelines"
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md"
                className="text-sm file:mr-3 file:rounded-full file:border file:bg-background file:px-4 file:py-1.5 file:text-sm file:font-medium"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rules">Rules for influencers</Label>
              <input
                id="rules"
                name="rules"
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md"
                className="text-sm file:mr-3 file:rounded-full file:border file:bg-background file:px-4 file:py-1.5 file:text-sm file:font-medium"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Shared with every creator you work with. PDF, Word, or text, up to 10 MB.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Anything else</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              maxLength={4000}
              defaultValue={defaults?.notes ?? ""}
              placeholder="Anything creators or our matching should know, in your own words."
            />
          </div>
        </div>

        {/* ── Navigation buttons ── */}
        <div className="mt-6 flex items-center justify-between gap-3">
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <Button type="button" onClick={() => setStep(step + 1)}>
              Continue
            </Button>
          ) : (
            <SubmitButton pendingLabel="Saving…">
              Save and start discovering
            </SubmitButton>
          )}
        </div>
      </form>
    </div>
  );
}
```

Key design decisions:
- **Hidden fields via CSS (`hidden` class), not conditional rendering.** All form inputs are always in the DOM so the single `saveBrandProfile` action receives every field. Steps show/hide sections with `className={step === N ? "..." : "hidden"}`.
- **WebsiteIngest is outside the form** (step 1 only) because forms can't nest — it has its own `<form>` for the scan action. This matches the current onboarding page structure.
- **ProposedProducts rendered on step 2** where products are conceptually grouped. The hidden `products_json` input is always in the form via ProposedProducts.
- **No partial save.** The form submits only on step 3. Back/Continue are `type="button"` so they don't trigger submission.
- **Progress bar uses 3 equal segments** instead of a single continuous bar — clearer step indication.

- [ ] **Step 2: Update the onboarding page to use the wizard**

Replace the content of `app/brand/onboarding/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/brand/onboarding-wizard";
import type { IngestProposal } from "@/lib/brand/ingest";
import type { BrandProfileDefaults } from "@/components/brand/brand-profile-form";
import Link from "next/link";

export default async function BrandOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; proposal?: string }>;
}) {
  const { user } = await requireRole("brand", "/brand/onboarding");
  const { error } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: existing } = await supabase
    .from("brand_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) redirect("/brand");

  const { data: ingestion } = await supabase
    .from("brand_ingestions")
    .select("website, payload")
    .eq("brand_id", user.id)
    .maybeSingle();
  const proposal = (ingestion?.payload as IngestProposal | undefined) ?? null;

  const defaults: BrandProfileDefaults | null = proposal
    ? {
        company: proposal.company || null,
        website: ingestion?.website ?? null,
        description: proposal.description || null,
        notes: proposal.tone ? `Tone of voice: ${proposal.tone}` : null,
        outreach_template: null,
        pref_niches: proposal.niches,
        pref_types: [],
        pref_types_other: null,
        guidelines_path: null,
        rules_path: null,
      }
    : null;

  const productsJson =
    proposal && proposal.products.length > 0
      ? JSON.stringify(proposal.products)
      : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Brand setup</h1>
        <Link
          href="/discover"
          className="shrink-0 text-sm font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Skip → Discover
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        This shapes which creators we suggest and gives the creators you work
        with your guidelines up front. Everything can be changed later in
        settings.
      </p>
      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-6">
        <OnboardingWizard
          defaults={defaults}
          proposal={proposal}
          website={ingestion?.website ?? null}
          productsJson={productsJson}
        />
      </div>
    </main>
  );
}
```

Changes from the original:
- Title changed to "Brand setup" (the wizard steps have their own per-step headings).
- The old progress bar (hardcoded 33%) and WebsiteIngest + BrandProfileForm are replaced by the single `<OnboardingWizard>` component.
- "Do this later → Discover" shortened to "Skip → Discover".
- Server-side data fetching and guard logic is identical.

- [ ] **Step 3: Test in browser**

1. Sign up as a new brand (or clear your `brand_profiles` row) → redirected to `/brand/onboarding`.
2. Verify step 1 shows: progress bar (1 of 3), website scan section, company name, website, description fields.
3. Click "Continue" → step 2: niches, formats, products section. Progress bar shows 2 of 3.
4. Click "Back" → returns to step 1 with fields preserved.
5. Scan a website on step 1 → page reloads with `?proposal=1`, fields pre-filled, step resets to 1 (expected — server round-trip).
6. Advance to step 2 → ProposedProducts shows if website had products.
7. Advance to step 3 → outreach template, file uploads, notes field. "Save and start discovering" button.
8. Submit on step 3 → profile saved, redirected to `/discover`.
9. Navigate to `/brand/onboarding` again → redirected to `/brand` (already onboarded).
10. "Skip → Discover" link works from any step.
11. Test mobile viewport — steps wrap and buttons are reachable.

- [ ] **Step 4: Commit**

```bash
git add components/brand/onboarding-wizard.tsx app/brand/onboarding/page.tsx
git commit -m "feat: break brand onboarding into 3-step guided wizard"
```

---

### Task 2: Dashboard Getting-Started Checklist

**Files:**
- Modify: `app/brand/page.tsx:31-43` (add products + campaigns count queries)
- Modify: `app/brand/page.tsx:106` (render checklist card above stats grid)

**Interfaces:**
- Consumes: Existing dashboard data (profile, conversations, deals) + two new count queries (brand_products, campaigns)
- Produces: A "Getting started" card rendered above the stats grid. No new exports.

- [ ] **Step 1: Add product and campaign count queries**

In `app/brand/page.tsx`, expand the `Promise.all` block (lines 31-43) to include two count-only queries:

Replace lines 31-43:
```tsx
const [profileRes, convRes, dealsRes, blockRes, productCountRes, campaignCountRes] =
  await Promise.all([
    supabase
      .from("brand_profiles")
      .select("company")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("conversations")
      .select("id, creator_id, status, created_at")
      .eq("brand_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("deals")
      .select("id, creator_id, offering_title, price_cents, status, requested_at")
      .eq("brand_id", user.id)
      .order("requested_at", { ascending: false }),
    supabase
      .from("brand_blocklist")
      .select("creator_id, created_at")
      .eq("brand_id", user.id),
    supabase
      .from("brand_products")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", user.id),
    supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", user.id),
  ]);
```

After the existing destructuring (line 50), add:
```tsx
const productCount = productCountRes.count ?? 0;
const campaignCount = campaignCountRes.count ?? 0;
```

- [ ] **Step 2: Compute checklist state and render the card**

After the `stat` helper function (line 80) and before the `return` statement (line 82), add:

```tsx
const checklist = [
  {
    label: "Complete your profile",
    done: true, // always true post-onboarding (profile row exists)
    href: "/brand/settings#profile",
  },
  {
    label: "Add your first product",
    done: productCount > 0,
    href: "/brand/settings#products",
  },
  {
    label: "Reach out to a creator",
    done: conversations.length > 0,
    href: "/discover",
  },
  {
    label: "Post a campaign",
    done: campaignCount > 0,
    href: "/campaigns",
  },
  {
    label: "Close your first deal",
    done: completed.length > 0,
    href: "/deals",
  },
];
const allDone = checklist.every((c) => c.done);
const doneCount = checklist.filter((c) => c.done).length;
```

Then in the JSX, insert the checklist card between the error message and the stats grid. After the error `{error && ...}` block (line 103) and before the stats `<div className="card-grid ...">` (line 106), add:

```tsx
{!allDone && (
  <section className="mt-6 rounded-2xl bg-card p-6 shadow-card">
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-base font-bold">Getting started</h2>
      <span className="text-xs font-medium tabular-nums text-muted-foreground">
        {doneCount} of {checklist.length}
      </span>
    </div>
    <ul className="mt-3 flex flex-col gap-2">
      {checklist.map((item) => (
        <li key={item.label}>
          <Link
            href={item.href}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-secondary"
          >
            <span
              className={`grid size-5 shrink-0 place-items-center rounded-full border text-xs ${
                item.done
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/30"
              }`}
            >
              {item.done && "✓"}
            </span>
            <span className={item.done ? "text-muted-foreground line-through" : "font-medium"}>
              {item.label}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  </section>
)}
```

Design notes:
- Card uses standard `rounded-2xl bg-card shadow-card` per DESIGN.md.
- Checkmark circles: filled ink pill when done, empty outline when pending — matches the Gallery Frame ink/outline pattern.
- The card auto-hides when all 5 items are done (`!allDone` guard). No dismiss button needed — the checklist is purely data-driven.
- Each item is a link to the relevant action page, so the checklist is directly actionable.
- "Getting started" heading + "N of 5" counter in the header gives progress context.

- [ ] **Step 3: Test in browser**

1. As a freshly onboarded brand (just profile, no products/conversations/campaigns/deals):
   - Dashboard shows "Getting started" card with 1 of 5 checked (profile).
   - Click "Add your first product" → goes to `/brand/settings#products`.
   - Add a product, return to dashboard → 2 of 5 checked.
2. Invite a creator from Discover → dashboard shows 3 of 5.
3. Post a campaign → 4 of 5.
4. Complete a deal → 5 of 5, card disappears entirely.
5. Verify card is above the stats grid but below error messages.
6. Verify card looks correct on mobile — items stack, links are tappable (44px target via py-2 + gap).
7. Verify the two new count queries don't slow page load (both are `head: true` count-only).

- [ ] **Step 4: Commit**

```bash
git add app/brand/page.tsx
git commit -m "feat: add getting-started checklist to brand dashboard"
```
