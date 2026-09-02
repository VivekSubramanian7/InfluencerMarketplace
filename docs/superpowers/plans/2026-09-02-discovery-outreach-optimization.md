# Discovery & Outreach Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate dead-ends in the brand discovery→first-contact funnel by cross-linking Discover, Campaigns, and creator storefronts so brands can start conversations from anywhere.

**Architecture:** Five independent UI additions (A–E) to existing pages. No schema changes, no new tables. All use the existing `sendReachouts` server action or thin wrappers around it. Each task ships alone.

**Tech Stack:** Next.js (App Router, Server Components), Supabase (RLS), Tailwind CSS, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-09-02-discovery-outreach-optimization-design.md`

## Global Constraints

- **Design system:** Follow `DESIGN.md` — Gallery Frame. Ink pills (`bg-foreground text-background rounded-full`) for primary actions. Cards: `rounded-2xl bg-card shadow-card`. Amber only for trust states.
- **No new dependencies.**
- **No schema changes.** All features use existing tables (`conversations`, `campaigns`, `brand_products`, `brand_blocklist`).
- **Server Components by default.**
- **The storefront page (`/c/[handle]`) uses ISR with `revalidate = 300`.** Any auth-dependent content (brand-only CTAs) must be conditional on the user session — ISR will cache the page, but Server Components can still check auth per-request since this is a dynamic route in practice (the `requireUser` is NOT called on storefront — it's a public page). We need to use `createServerSupabase` and check auth optionally without redirecting unauthenticated visitors.

---

### Task 1: "Invite to Chat" on Creator Storefront

**Files:**
- Modify: `app/c/[handle]/page.tsx:36-55` (add optional auth check + conversation/blocklist lookup)
- Modify: `app/c/[handle]/page.tsx:93-116` (render invite CTA in the identity banner)
- Create: `app/c/[handle]/actions.ts` (thin server action wrapping single-creator invite)

**Interfaces:**
- Consumes: `sendReachouts` pattern from `app/discover/actions.ts` (reuse the conversation insert + notify logic). The storefront's `getStorefront` query returns `profile.userId` which we need for the creator_id.
- Produces: "Invite to chat" button on storefront (brand-only), "Open conversation →" link if conversation exists. A `inviteFromStorefront` server action in a new actions file.

- [ ] **Step 1: Create server action for single-creator invite**

Create `app/c/[handle]/actions.ts`:

```tsx
"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { notify } from "@/lib/notify";
import { friendlyDbError } from "@/lib/errors";

const DEFAULT_TEMPLATE =
  "Hi! We came across your work and think you'd be a great fit for our brand. " +
  "We'd love to collaborate on a video.";

export async function inviteFromStorefront(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();
  const creatorId = String(formData.get("creator_id") ?? "");
  const handle = String(formData.get("handle") ?? "");

  if (!creatorId) redirect(`/c/${handle}?error=missing`);

  const { data: profile } = await supabase
    .from("brand_profiles")
    .select("outreach_template, company")
    .eq("user_id", user.id)
    .maybeSingle();
  const message = profile?.outreach_template || DEFAULT_TEMPLATE;
  const brandLabel = profile?.company || "A brand";

  const { error } = await supabase.from("conversations").insert({
    brand_id: user.id,
    creator_id: creatorId,
    invite_message: message,
  });

  if (error) {
    if (error.code === "23505") {
      redirect(`/c/${handle}?error=` + encodeURIComponent("Already invited — check your inbox"));
    }
    redirect(`/c/${handle}?error=` + encodeURIComponent(friendlyDbError(error)));
  }

  await notify({
    userId: creatorId,
    kind: "invite",
    title: `${brandLabel} wants to work with you`,
    body: message,
    href: "/inbox",
    email: true,
  });

  redirect(`/c/${handle}?invited=1`);
}
```

- [ ] **Step 2: Add optional brand context to storefront page**

In `app/c/[handle]/page.tsx`, after line 44 (`if (!storefront) notFound();`), add optional brand context:

```tsx
// optional brand context — don't redirect if unauthenticated
const supabase = await createServerSupabase();
const { data: authData } = await supabase.auth.getUser();
const brandUserId = authData?.user?.id ?? null;

let existingConversation: { id: string } | null = null;
let isBlocked = false;
let isBrand = false;

if (brandUserId) {
  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", brandUserId)
    .maybeSingle();
  isBrand = profileData?.role === "brand";

  if (isBrand) {
    const [convRes, blockRes] = await Promise.all([
      supabase
        .from("conversations")
        .select("id")
        .eq("brand_id", brandUserId)
        .eq("creator_id", profile.userId)
        .maybeSingle(),
      supabase
        .from("brand_blocklist")
        .select("creator_id")
        .eq("brand_id", brandUserId)
        .eq("creator_id", profile.userId)
        .maybeSingle(),
    ]);
    existingConversation = convRes.data;
    isBlocked = !!blockRes.data;
  }
}
```

Add imports at the top:
```tsx
import { createServerSupabase } from "@/lib/supabase/server";
import { inviteFromStorefront } from "./actions";
```

- [ ] **Step 3: Render invite CTA in the identity banner**

In `app/c/[handle]/page.tsx`, after the niches list (after line 116, inside the `<section>` banner), add:

```tsx
{isBrand && !isBlocked && (
  <div className="mt-6">
    {existingConversation ? (
      <a
        href={`/inbox/${existingConversation.id}`}
        className="inline-flex items-center gap-2 rounded-full bg-white/95 px-5 py-2.5 text-sm font-bold shadow-card transition-transform hover:scale-[1.02]"
        style={{ color: gradient.deep }}
      >
        Open conversation →
      </a>
    ) : (
      <form action={inviteFromStorefront} className="inline">
        <input type="hidden" name="creator_id" value={profile.userId} />
        <input type="hidden" name="handle" value={profile.handle} />
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full bg-white/95 px-5 py-2.5 text-sm font-bold shadow-card transition-transform hover:scale-[1.02]"
          style={{ color: gradient.deep }}
        >
          Invite to chat
        </button>
      </form>
    )}
  </div>
)}
```

Also handle the `invited` and `error` search params. Add `searchParams` to the page props:

```tsx
export default async function StorefrontPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ error?: string; invited?: string }>;
}) {
  const { handle } = await params;
  const { error: pageError, invited } = await searchParams;
```

And render feedback below the banner (after line 117):

```tsx
{pageError && (
  <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
    {pageError}
  </p>
)}
{invited && (
  <p className="mt-4 rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
    Invitation sent! Check your inbox.
  </p>
)}
```

- [ ] **Step 4: Test in browser**

1. Visit `/c/[handle]` as a brand with no existing conversation → "Invite to chat" button appears.
2. Click it → redirects back with success banner, button changes to "Open conversation →".
3. Click "Open conversation →" → navigates to `/inbox/[conv-id]`.
4. Visit as unauthenticated user → no invite button, no errors.
5. Visit as creator → no invite button.
6. Visit a blocked creator's storefront → no invite button.

- [ ] **Step 5: Commit**

```bash
git add app/c/[handle]/page.tsx app/c/[handle]/actions.ts
git commit -m "feat: add invite-to-chat button on creator storefront for brands"
```

---

### Task 2: "Invite to Chat" from Campaign Proposals

**Files:**
- Modify: `app/campaigns/[id]/page.tsx:113-139` (add conversation lookup in OwnerPanel)
- Modify: `app/campaigns/[id]/page.tsx:155-213` (add invite button per applicant)

**Interfaces:**
- Consumes: `inviteFromStorefront` server action from Task 1 (reuse it — it takes `creator_id` and `handle` and creates a conversation). OR import `sendReachouts` from discover. Simpler: just import `inviteFromStorefront` which handles single-creator invites cleanly.
- Produces: "Invite to chat" or "Open conversation →" per campaign applicant, alongside Accept/Decline.

- [ ] **Step 1: Add conversation lookup in OwnerPanel**

In `app/campaigns/[id]/page.tsx`, inside the `OwnerPanel` function, after the `creatorIds` name/handle lookup (after line 139), add:

```tsx
// check existing conversations with applicants
const convByCreator = new Map<string, string>();
if (creatorIds.length > 0) {
  const { data: convs } = await supabase
    .from("conversations")
    .select("id, creator_id")
    .eq("brand_id", (await supabase.auth.getUser()).data.user!.id)
    .in("creator_id", creatorIds);
  for (const c of convs ?? []) convByCreator.set(c.creator_id, c.id);
}
```

Add import at top of file:
```tsx
import { inviteFromStorefront } from "@/app/c/[handle]/actions";
```

- [ ] **Step 2: Add invite button per applicant**

In the proposal list rendering (inside the `visible.map` block), after the Accept/Decline buttons (after line 194), add:

```tsx
{a.status === "pending" && (
  <div className="mt-3 flex flex-wrap gap-2">
    <form action={decideApplication}>
      <input type="hidden" name="campaign_id" value={campaignId} />
      <input type="hidden" name="id" value={a.id} />
      <input type="hidden" name="decision" value="accepted" />
      <Button type="submit" size="sm">Accept</Button>
    </form>
    <form action={decideApplication}>
      <input type="hidden" name="campaign_id" value={campaignId} />
      <input type="hidden" name="id" value={a.id} />
      <input type="hidden" name="decision" value="declined" />
      <Button type="submit" variant="outline" size="sm">Decline</Button>
    </form>
    {convByCreator.has(a.creator_id) ? (
      <Link
        href={`/inbox/${convByCreator.get(a.creator_id)}`}
        className="inline-flex h-8 items-center rounded-full border px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        Open conversation →
      </Link>
    ) : (
      <form action={inviteFromStorefront}>
        <input type="hidden" name="creator_id" value={a.creator_id} />
        <input type="hidden" name="handle" value={handle ?? ""} />
        <Button type="submit" variant="outline" size="sm">
          Invite to chat
        </Button>
      </form>
    )}
  </div>
)}
```

Note: `handle` comes from `handleById.get(a.creator_id)`. We need to pass the handle into the button's hidden field. Update the variable reference:

```tsx
<input type="hidden" name="handle" value={handleById.get(a.creator_id) ?? ""} />
```

The `inviteFromStorefront` action redirects to `/c/[handle]?invited=1` after success. For the campaign context, we'd rather stay on the campaign page. We have two options:
1. Create a separate `inviteFromCampaign` action that redirects back to the campaign.
2. Add an optional `redirect_to` param to `inviteFromStorefront`.

Option 2 is simpler. Update `inviteFromStorefront` in `app/c/[handle]/actions.ts` — add a `redirect_to` hidden field that overrides the default redirect target:

At the top of the function, after extracting `handle`:
```tsx
const redirectBack = String(formData.get("redirect_to") ?? "") || `/c/${handle}`;
```

Change the success redirect (replace the last `redirect` call):
```tsx
redirect(redirectBack.includes("?") ? `${redirectBack}&invited=1` : `${redirectBack}?invited=1`);
```

Change the duplicate error redirect:
```tsx
if (error.code === "23505") {
  redirect(redirectBack.includes("?") ? `${redirectBack}&error=already-invited` : `${redirectBack}?error=already-invited`);
}
redirect(redirectBack.includes("?") ? `${redirectBack}&error=${encodeURIComponent(friendlyDbError(error))}` : `${redirectBack}?error=${encodeURIComponent(friendlyDbError(error))}`);
```

Then in the campaign form, add a hidden field so it redirects back to the campaign page:
```tsx
<input type="hidden" name="redirect_to" value={`/campaigns/${campaignId}`} />
```

- [ ] **Step 3: Test in browser**

1. Open a campaign with pending proposals.
2. Verify "Invite to chat" appears next to Accept/Decline for each pending applicant.
3. Click "Invite to chat" → page reloads, button changes to "Open conversation →".
4. Click "Open conversation →" → navigates to inbox conversation.
5. Accept a different applicant → verify invite button is unaffected.

- [ ] **Step 4: Commit**

```bash
git add app/campaigns/[id]/page.tsx app/c/[handle]/actions.ts
git commit -m "feat: add invite-to-chat for campaign applicants"
```

---

### Task 3: Link Campaign Creation from Discover

**Files:**
- Modify: `app/discover/page.tsx:287-302` (add campaign CTA in empty state and below results)
- Modify: `app/campaigns/page.tsx:132-180` (read search params to pre-fill campaign form)

**Interfaces:**
- Consumes: `filters` object already parsed in discover page (specifically `filters.type` and `filters.niche`).
- Produces: A "Post a campaign" link on Discover, pre-filled campaign form on `/campaigns`.

- [ ] **Step 1: Add campaign CTA on Discover page**

In `app/discover/page.tsx`, after the results count line (after line 285), add a campaign prompt when a format filter is active:

```tsx
{isBrand && filters.type && (
  <p className="mt-2 text-sm text-muted-foreground">
    Not finding the right fit?{" "}
    <Link
      href={`/campaigns?prefill_type=${filters.type}${filters.niche ? `&prefill_niche=${encodeURIComponent(filters.niche)}` : ""}`}
      className="font-medium underline underline-offset-2 hover:text-foreground"
    >
      Post a campaign
    </Link>{" "}
    and let creators come to you.
  </p>
)}
```

Also add it in the empty state (inside the empty results `<div>`, after line 300):

```tsx
{isBrand && (
  <Button asChild className="mt-2">
    <Link href={`/campaigns?prefill_type=${filters.type ?? ""}${filters.niche ? `&prefill_niche=${encodeURIComponent(filters.niche)}` : ""}`}>
      Post a campaign instead
    </Link>
  </Button>
)}
```

- [ ] **Step 2: Pre-fill campaign form from URL params**

In `app/campaigns/page.tsx`, update the `searchParams` type to include prefill params:

```tsx
searchParams: Promise<{ error?: string; saved?: string; prefill_type?: string; prefill_niche?: string }>;
```

Extract them:
```tsx
const { error, saved, prefill_type, prefill_niche } = await searchParams;
```

Pass to `BrandCampaigns`:
```tsx
<BrandCampaigns userId={user.id} supabase={supabase} prefillType={prefill_type} prefillNiche={prefill_niche} />
```

Update `BrandCampaigns` signature and the form:

```tsx
async function BrandCampaigns({
  userId, supabase, prefillType, prefillNiche,
}: {
  userId: string; supabase: Supabase; prefillType?: string; prefillNiche?: string;
}) {
```

In the content type `<select>` (line 150-161), set `defaultValue`:
```tsx
defaultValue={prefillType || "dedicated_video"}
```

In the description `<Textarea>` (line 140-146), set `defaultValue` when niche is provided:
```tsx
defaultValue={prefillNiche ? `Looking for ${prefillNiche} creators to…` : ""}
placeholder="The product, the audience you want to reach, and what a great video looks like to you."
```

- [ ] **Step 3: Test in browser**

1. Go to Discover, set format filter to "Integration" → "Post a campaign" link appears below results count.
2. Click it → navigates to `/campaigns` with form pre-filled: content type = "Integration".
3. Add niche filter "gaming" → campaign link includes niche → description seeded with "Looking for gaming creators to…".
4. Search with no filters → no campaign CTA.
5. Empty results with format filter → "Post a campaign instead" button appears.

- [ ] **Step 4: Commit**

```bash
git add app/discover/page.tsx app/campaigns/page.tsx
git commit -m "feat: link campaign creation from Discover with pre-filled filters"
```

---

### Task 4: Single-Creator Invite from Discover Cards

**Files:**
- Modify: `app/discover/page.tsx:312-403` (add per-card invite button)

**Interfaces:**
- Consumes: `sendReachouts` from `app/discover/actions.ts` (already imported). Each card already has `c.userId`.
- Produces: Per-card "Invite" button that creates a conversation for one creator.

- [ ] **Step 1: Add per-card invite button**

In `app/discover/page.tsx`, inside the creator card `<li>` (line 317), after the checkbox label (line 328), add a quick-invite form. The button should NOT be inside the `<Link>` element to avoid navigation on click:

```tsx
<li key={c.userId} className="relative">
  {isBrand && filters.tab === "new" && (
    <label className="absolute right-3 top-3 z-10 grid size-8 cursor-pointer place-items-center rounded-full bg-white/90 shadow-card transition-transform hover:scale-110">
      <input
        type="checkbox"
        name="creator_id"
        value={c.userId}
        aria-label={`Select ${c.displayName ?? c.handle} for reachout`}
        className="size-4 accent-primary"
      />
    </label>
  )}
  {isBrand && filters.tab === "new" && (
    <form
      action={sendReachouts}
      className="absolute left-3 top-3 z-10"
    >
      <input type="hidden" name="creator_id" value={c.userId} />
      <button
        type="submit"
        aria-label={`Invite ${c.displayName ?? c.handle} to chat`}
        className="grid size-8 place-items-center rounded-full bg-white/90 shadow-card text-muted-foreground transition-all hover:scale-110 hover:bg-primary hover:text-primary-foreground"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    </form>
  )}
  <Link href={`/c/${c.handle}`} className="group flex h-full flex-col ...">
    {/* ... existing card content ... */}
  </Link>
</li>
```

The `sendReachouts` action already handles single-creator invites (it takes `creator_id` from FormData, which can be a single value). It redirects to `/inbox?sent=1` on success or `/discover?error=...` on failure.

Note: The checkbox (right side) is for bulk select. The chat icon (left side) is for instant single invite. They serve different purposes — checkbox accumulates selections for batch invite, icon button sends immediately.

- [ ] **Step 2: Test in browser**

1. Go to Discover as a brand, "New creators" tab.
2. Verify chat icon appears at top-left of each creator card.
3. Click the icon on one card → redirected to `/inbox?sent=1`.
4. Go back to Discover → that creator should no longer appear (excluded from "New" tab since conversation exists).
5. Verify clicking the card body (not the icon) still navigates to `/c/[handle]`.
6. Verify the checkbox for bulk select still works independently.

- [ ] **Step 3: Commit**

```bash
git add app/discover/page.tsx
git commit -m "feat: add single-click invite button on Discover creator cards"
```

---

### Task 5: Show Matching Campaigns on Creator Storefront

**Files:**
- Modify: `app/c/[handle]/page.tsx` (add matching campaigns query and info card, brand-only)

**Interfaces:**
- Consumes: `profile.userId` (creator's ID, already loaded), brand's `campaigns` table, creator's offering types from `storefront.offerings`.
- Produces: Info card showing matching open campaigns, rendered below the identity banner.

- [ ] **Step 1: Add matching campaigns query**

In `app/c/[handle]/page.tsx`, inside the `if (isBrand)` block added in Task 1, add a campaigns query:

```tsx
let matchingCampaigns: { id: string; title: string; offering_type: string }[] = [];
if (isBrand) {
  // ... existing conversation + blocklist queries ...

  const creatorTypes = [...new Set(offerings.map((o) => o.type))];
  if (creatorTypes.length > 0) {
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id, title, offering_type")
      .eq("brand_id", brandUserId)
      .eq("status", "open")
      .in("offering_type", creatorTypes)
      .limit(5);
    matchingCampaigns = campaigns ?? [];
  }
}
```

- [ ] **Step 2: Render matching campaigns info card**

After the identity banner section and after the `invited`/`error` feedback messages, add:

```tsx
{isBrand && matchingCampaigns.length > 0 && (
  <div className="mt-4 rounded-2xl bg-secondary/50 p-5">
    <p className="text-sm font-medium">
      You have {matchingCampaigns.length} open campaign{matchingCampaigns.length !== 1 ? "s" : ""} matching this creator&apos;s work:
    </p>
    <ul className="mt-2 flex flex-wrap gap-2">
      {matchingCampaigns.map((c) => (
        <li key={c.id}>
          <Link
            href={`/campaigns/${c.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium shadow-sm hover:border-primary/40"
          >
            {c.title}
          </Link>
        </li>
      ))}
    </ul>
  </div>
)}
```

- [ ] **Step 3: Test in browser**

1. As a brand with open campaigns (e.g., type = "dedicated_video"), visit a creator who has a dedicated video offering.
2. Verify the matching campaigns card appears below the banner.
3. Click a campaign link → navigates to that campaign page.
4. Visit a creator with no matching offering types → no card.
5. Visit as a non-brand user → no card.

- [ ] **Step 4: Commit**

```bash
git add app/c/[handle]/page.tsx
git commit -m "feat: show matching open campaigns on creator storefront for brands"
```
