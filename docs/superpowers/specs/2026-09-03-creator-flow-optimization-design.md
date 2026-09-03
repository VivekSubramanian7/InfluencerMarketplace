# Creator Flow Optimization — Design Spec

**Date:** 2026-09-03  
**Scope:** 6 optimizations to reduce friction in creator workflows  
**Schema changes:** None  
**Estimated files touched:** 10–14

---

## Problem

Creators experience four categories of friction:

1. **Duplicated pages** — Profile, offerings, and portfolio forms exist in both `/onboarding/*` and `/dashboard/*` with slightly different labels, validation, and navigation. Any fix or improvement must be applied twice.
2. **Dashboard is a link farm** — `/dashboard` is a hub that links to 3 sub-pages (`/profile`, `/offerings`, `/portfolio`). Each sub-page is a full page load with no shared context. Creators bounce between 4 routes to manage their storefront.
3. **Inbox-to-deal is 4+ clicks** — A creator going from "new invitation" to "active deal" must: accept invite (page reload), open conversation, scroll to find offer, accept offer (page reload), then click "Open the deal" link. No visual cue on the invitation card that an offer is waiting.
4. **Deal detail is visually dense** — Brief, messages, pre-deal discussion, action buttons, review form, and full timeline all render expanded on one page. Action buttons are buried below the fold. The review form takes up space even when irrelevant (non-completed deals).

---

## A. Dashboard Tab Consolidation

**Goal:** Replace 4 dashboard routes with a single tabbed page. Fewer page loads, faster context-switching.

**How:**
- `/dashboard` becomes the single page with 4 tabs: **Overview | Profile | Offerings | Portfolio**.
- Tab state managed via `?tab=` search param (linkable, bookmarkable, works with server components).
- **Overview** tab keeps the existing stats cards (earned, active deals, rating), recent deals list, and setup progress checklist.
- **Profile** tab renders the profile editing form (handle, bio, niches, country, languages) + publish/unpublish toggle.
- **Offerings** tab renders the offerings list with toggle/delete + add form.
- **Portfolio** tab renders the portfolio grid with add/delete.
- Default tab (no `?tab=` param) is Overview.

**What moves where:**
- `app/dashboard/profile/page.tsx` content → `components/creator/profile-form.tsx`
- `app/dashboard/offerings/page.tsx` content → `components/creator/offerings-panel.tsx`
- `app/dashboard/portfolio/page.tsx` content → `components/creator/portfolio-panel.tsx`
- The 3 sub-page files are deleted.

**Internal link updates:**
- All links pointing to `/dashboard/profile` → `/dashboard?tab=profile`
- All links pointing to `/dashboard/offerings` → `/dashboard?tab=offerings`
- All links pointing to `/dashboard/portfolio` → `/dashboard?tab=portfolio`
- Mobile nav "New" center button → `/dashboard?tab=offerings` (was `/dashboard/offerings/new`)

**Server action redirect updates:**
- `saveCreatorProfile` redirects to `/dashboard?tab=profile&saved=1` (was `/dashboard/profile?saved=1`)
- `setProfileStatus` redirects to `/dashboard?tab=profile&saved=1`
- `saveOffering`, `toggleOffering`, `deleteOffering` redirect to `/dashboard?tab=offerings&saved=1`
- `addPortfolioItem`, `deletePortfolioItem` redirect to `/dashboard?tab=portfolio&saved=1`

**Files:**
- Modify: `app/dashboard/page.tsx` — add tab bar + conditional rendering
- Create: `components/creator/profile-form.tsx` — extracted from dashboard profile page
- Create: `components/creator/offerings-panel.tsx` — extracted from dashboard offerings page
- Create: `components/creator/portfolio-panel.tsx` — extracted from dashboard portfolio page
- Delete: `app/dashboard/profile/page.tsx`
- Delete: `app/dashboard/offerings/page.tsx`
- Delete: `app/dashboard/portfolio/page.tsx`
- Modify: `app/dashboard/actions.ts` — update redirect paths
- Modify: `components/mobile-nav.tsx` — update "New" button href

---

## B. Unified Onboarding/Dashboard Form Components

**Goal:** Eliminate form duplication. One source of truth for each form, used by both onboarding wizard and dashboard tabs.

**How:**
The 3 components created in Section A (`profile-form.tsx`, `offerings-panel.tsx`, `portfolio-panel.tsx`) accept a `mode` prop:

```tsx
mode: "wizard" | "settings"
```

Behavior differences by mode:

| Aspect | `wizard` | `settings` |
|--------|----------|------------|
| Submit button label | "Save and continue" | "Save profile" / "Save offering" |
| After-submit behavior | Server action redirects to next onboarding step | Server action redirects to same dashboard tab |
| "Continue →" footer | Rendered (links to next step) | Not rendered |
| Component wrapper | Caller wraps in `WizardShell` | Caller renders in dashboard tab |

Each component also accepts:
- `action` — the bound server action (onboarding's `saveProfileStep` vs dashboard's `saveCreatorProfile`)
- Data props — current profile, offerings list, portfolio items

**Data fetching pattern:** Data fetching stays in the page file (server component). The shared form component is a client or server component that receives data as props. This keeps the shared components pure — no Supabase client calls, no `cookies()`, just props in, JSX out.

**What changes in onboarding pages:**
- `app/onboarding/profile/page.tsx` slims to: data fetch + `<WizardShell><ProfileForm mode="wizard" action={saveProfileStep} ... /></WizardShell>`
- `app/onboarding/offerings/page.tsx` slims to: data fetch + `<WizardShell><OfferingsPanel mode="wizard" action={saveOfferingStep} ... /></WizardShell>`
- `app/onboarding/highlights/page.tsx` slims to: data fetch + `<WizardShell><PortfolioPanel mode="wizard" action={addHighlight} ... /></WizardShell>`

**What stays separate:**
- `app/onboarding/socials/page.tsx` — no dashboard equivalent, stays as-is
- `app/onboarding/publish/page.tsx` — unique publish checklist, stays as-is
- All server actions — onboarding actions redirect to next step, dashboard actions redirect to same tab. The validation difference (onboarding requires offering description) stays in `saveOfferingStep`.

**Files:**
- Modify: `components/creator/profile-form.tsx` — add `mode` prop
- Modify: `components/creator/offerings-panel.tsx` — add `mode` prop
- Modify: `components/creator/portfolio-panel.tsx` — add `mode` prop
- Modify: `app/onboarding/profile/page.tsx` — slim to wrapper + shared component
- Modify: `app/onboarding/offerings/page.tsx` — slim to wrapper + shared component
- Modify: `app/onboarding/highlights/page.tsx` — slim to wrapper + shared component

---

## C. Streamline Inbox Invite → Offer → Deal Flow

**Goal:** Reduce the invite-to-deal journey from 4+ clicks to 2 clicks.

### C1. Offer preview badge on invitation cards

In the pending invitations section of `/inbox`, when an invitation has a pending offer attached, show a compact badge on the invitation card:

```
"Includes an offer · $500"
```

The inbox page already queries offers per conversation. Surface the pending offer's price in the invitation card UI. No new queries needed.

### C2. Auto-scroll to offer after accepting invitation

When `respondInvite` accepts an invitation, redirect to `/inbox/[id]?focus=offer` instead of `/inbox/[id]`.

On the conversation detail page, a small client component (`useEffect` + `scrollIntoView`) checks for the `focus=offer` search param and scrolls to `#offer-section` on mount. The anchor already exists (used by brand-side "Send offer" link).

New component: `components/inbox/auto-scroll.tsx` (~10 lines, client component).

### C3. Offer acceptance navigates directly to deal

Currently `respondOffer` (accept path) redirects back to the conversation page with a success message. The creator must then click "Open the deal →" manually.

Change: `respondOffer` redirects to `/deals/${dealId}` on acceptance instead of `/inbox/${conversationId}?saved=1`. The RPC `accept_offer` already returns the deal ID.

**Files:**
- Modify: `app/inbox/page.tsx` — add offer badge to invitation cards
- Create: `components/inbox/auto-scroll.tsx` — client component for scroll-into-view
- Modify: `app/inbox/[id]/page.tsx` — mount AutoScroll component
- Modify: `app/inbox/actions.ts` — update `respondInvite` redirect (add `?focus=offer`), update `respondOffer` redirect (go to deal page)

---

## D. Deal Detail — Collapsible Sections + Modal Review + Sticky Actions

**Goal:** Reduce visual density on `/deals/[id]`. Surface actions prominently, collapse reference-only content.

### D1. Collapse timeline by default

Wrap the timeline section in a `<details>` element (same pattern already used for pre-deal discussion).

- Collapsed label: `"Timeline · {events.length} events"`
- Expandable with one click
- No logic changes

### D2. Move review form to a modal

Currently the review form (star rating + textarea + submit) renders inline at the bottom of completed deals. Move it to a dialog triggered by a "Leave a review" button.

- New component: `components/deals/review-modal.tsx` — client component wrapping `<dialog>`
- Contains the same form fields (rating 1-5, body textarea) and same `submitReview` server action
- "Leave a review" button appears in the Next Steps section only when `deal.status === 'completed'` and no review exists
- Removes ~40 lines of inline form code from the deal page

### D3. Move "Next Steps" to a sticky card below progress bar

Currently action buttons (accept deal, submit preview, etc.) render in a section below the brief and messages — below the fold on most screens. Move the Next Steps section into a highlighted card directly below the progress bar.

- Card uses existing amber accent pattern for attention states
- Contains: status label + one-line description + action button(s)
- Same `performDealAction` server action, same hidden inputs
- Position change only — no logic changes

**Files:**
- Modify: `app/deals/[id]/page.tsx` — collapse timeline, reposition actions, replace inline review with modal trigger
- Create: `components/deals/review-modal.tsx` — dialog with review form

---

## E. Campaign Application — Smarter Defaults & Context

**Goal:** Help creators write better pitches faster by reducing blank-page syndrome and providing self-context.

### E1. Contextual pitch placeholders

Replace the empty textarea placeholder with guidance that adapts to the campaign's offering type:

| Offering type | Placeholder |
|--------------|-------------|
| `dedicated_video` | "What angle would you take? Mention your audience size and why they'd care about this product." |
| `integration` | "How would you weave this into your content? What video would this fit naturally into?" |
| `short_form_post` | "What hook would you use? What's your typical view count on shorts?" |
| `ugc_video` | "Describe your production style and turnaround. Include any relevant past UGC work." |

A `pitchPlaceholder(offeringType: string): string` helper, defined inline or in a small util. One placeholder attribute change in the creator panel's textarea.

### E2. Creator context card alongside application form

Show a compact "Your profile" summary card next to (desktop, `md:grid-cols-[1fr_280px]`) or above (mobile) the application form:

- Total followers (from `public_creator_stats`)
- Star rating + review count (if any)
- Completed deals count
- Active offering types as badges

Data source: `public_creator_stats` view (already used on storefront pages). One additional query in the campaign detail page loader when the user is a creator.

**Files:**
- Modify: `app/campaigns/[id]/page.tsx` — add placeholder helper, add stats query, render context card alongside form

---

## F. Notification & Mobile UX Fixes

**Goal:** Make notifications usable on mobile and add navigation shortcuts to actionable notification types.

### F1. Always-visible mark-as-read on mobile

Current: checkmark button has `opacity-0 transition-opacity group-hover:opacity-100`. On touch devices, creators cannot mark individual notifications as read.

Change: add `max-md:opacity-100` to make the button always visible on mobile.

```
opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100
```

One Tailwind class addition. The button is already rendered, positioned, and wired to the `markRead` action.

### F2. Quick-action buttons on actionable notifications

For notification kinds with a clear destination, render a labeled button instead of relying on the whole card being an invisible link:

| Notification kind | Button label | Destination |
|---|---|---|
| `offer` (new offer received) | "View offer" | `/inbox/[id]?focus=offer` |
| `booking` (new deal requested) | "View deal" | `/deals/[id]` |
| `application_response` (accepted) | "Open deal" | `/deals/[id]` |
| `invite` (brand invited to chat) | "View invite" | `/inbox` |

These are navigation shortcuts, not inline action buttons. The `href` already exists on every notification record. ~15 lines of conditional rendering in the notification list component.

**Files:**
- Modify: `components/notifications/notification-list.tsx` — add mobile opacity class, add quick-action buttons

---

## Files Summary

| Change | Create | Modify | Delete |
|--------|--------|--------|--------|
| A. Dashboard tabs | 3 components | 3 files (page, actions, mobile-nav) | 3 pages |
| B. Unified forms | — | 6 files (3 components + 3 onboarding pages) | — |
| C. Inbox flow | 1 component | 3 files (inbox page, detail, actions) | — |
| D. Deal detail | 1 component | 1 file (deal page) | — |
| E. Campaign app | — | 1 file (campaign detail) | — |
| F. Notifications | — | 1 file (notification list) | — |
| **Total** | **5** | **~14** | **3** |

All changes are frontend-only. No database migrations. No new server actions (existing actions get redirect path updates only).
