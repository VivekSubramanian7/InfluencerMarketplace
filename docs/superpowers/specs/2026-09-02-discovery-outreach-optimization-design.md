# Discovery & Outreach Optimization — Design Spec

**Date:** 2026-09-02  
**Scope:** 5 optimizations to reduce friction in the brand discovery→first-contact funnel  
**Schema changes:** None  
**Estimated files touched:** 5–7

---

## Problem

Brands have three disconnected paths to engage creators (Discover, Campaigns, Storefront booking), but the paths don't cross-link and key actions are missing:

1. **Storefront is a dead end for negotiation.** Brand visits `/c/[handle]`, likes the creator, but the only CTA is "Book" at listing price. No way to start a conversation to discuss scope/price without going back to Discover and using bulk reachout.
2. **Campaign proposals are accept-or-decline only.** Brand reviewing applications can't start a conversation with a creator to negotiate before formally accepting. It's a binary gate with no middle ground.
3. **Discover and Campaigns are parallel universes.** No cross-linking. Can't turn a discovery search into a campaign brief. Can't invite a creator from their campaign proposal.
4. **Bulk reachout is the only way to start a conversation.** Even for one creator, you must go to Discover, find them, checkbox-select them, and click "Invite selected."

---

## A. "Invite to Chat" on Creator Storefront

**Goal:** Let brands start a conversation directly from a creator's public profile, alongside the existing "Book" CTAs.

**How:**
- On `/c/[handle]`, when the visitor is a brand, show an "Invite to chat" button in the header area (next to or below the creator's name/bio).
- Clicking it calls the same server action used by bulk reachout (`sendReachouts`) but for a single creator ID.
- If a conversation already exists: show "Open conversation →" link to `/inbox/[conversationId]` instead.
- If the creator is blocked: don't show the button.

**Data needed:**
- Check `conversations` table for existing (brand_id, creator_id) pair.
- Check `brand_blocklist` for existing block.
- Both queries are cheap and can run in parallel with existing storefront data.

**Files:**
- `app/c/[handle]/page.tsx` — add brand context check, conversation lookup, and CTA button
- `app/discover/actions.ts` — reuse existing `sendReachouts` or extract a `sendSingleReachout` helper

---

## B. "Invite to Chat" from Campaign Proposals

**Goal:** Let brands start a conversation with a campaign applicant before accepting or declining, so they can negotiate terms.

**How:**
- On `/campaigns/[id]`, for each pending application, add an "Invite to chat" button alongside Accept/Decline.
- Uses the same reachout mechanism as Discover.
- If conversation already exists with this creator: show "Open conversation →" link instead.

**Data needed:**
- For each applicant's creator_id, check if a conversation exists with the brand.
- Can batch-query all applicant creator_ids in one query.

**Files:**
- `app/campaigns/[id]/page.tsx` — add conversation check per applicant, render invite/link button

---

## C. Link Campaign Creation from Discover

**Goal:** Bridge "I'm searching for creators" with "I want creators to come to me" by offering to create a campaign pre-filled from current Discover filters.

**How:**
- On `/discover`, when filters are active (especially `type` or `niche`), show a subtle CTA: "Not finding the right fit? Post a campaign" that links to `/campaigns/new?type={currentType}&niche={currentNiche}`.
- On `/campaigns/new` (the creation form on `/campaigns`), read URL params and pre-fill the content type dropdown and seed the description textarea with the niche context.

**Files:**
- `app/discover/page.tsx` — add campaign CTA when filters are active
- `app/campaigns/page.tsx` — read search params to pre-fill campaign form

---

## D. Single-Creator Invite from Discover Cards

**Goal:** Let brands invite a single creator without the checkbox→bulk flow.

**How:**
- On each creator card in Discover (New creators tab only), add a small "Invite" icon button.
- Clicking it submits a form with just that creator's ID to `sendReachouts`.
- The existing bulk "Invite selected" flow remains for multi-select.
- After invite, the card updates to show "Invited" badge (page revalidates).

**Design:**
- Small outlined icon button (mail or message icon) at the card's top-right corner.
- Appears on hover on desktop, always visible on mobile.
- Does NOT interfere with the card's click-through to `/c/[handle]` (button stops propagation or is positioned outside the link).

**Files:**
- `app/discover/page.tsx` — add per-card invite button form

---

## E. Show Matching Campaigns on Creator Storefront

**Goal:** When a brand visits a creator's storefront and has open campaigns matching the creator's content types, nudge them to share the campaign.

**How:**
- On `/c/[handle]`, if the visitor is a brand, query their open campaigns where `offering_type` matches any of the creator's active offering types.
- If matches found: show a small info card below the header: "You have {N} open campaign(s) matching this creator's work" with links to those campaigns.
- This is passive — no action required, just awareness that the brand's campaign funnel may already be serving them.

**Data needed:**
- Creator's active offering types (already loaded for the storefront).
- Brand's open campaigns matching those types (one query).

**Files:**
- `app/c/[handle]/page.tsx` — add campaign match query and info card for brands

---

## Out of Scope

- Merging Discover and Campaigns into a single interface.
- Creator-side discovery optimizations.
- Changing the bulk reachout mechanism (just adding single-invite alongside it).
- Campaign application negotiation (B adds conversation, not price renegotiation).

---

## Testing Approach

- **A:** Visit `/c/[handle]` as a brand → "Invite to chat" appears → click → redirects to inbox. Visit again → shows "Open conversation →".
- **B:** Review campaign proposals → "Invite to chat" appears next to Accept/Decline → click → conversation created.
- **C:** Apply filters on Discover → "Post a campaign" link appears → click → campaign form pre-filled with type.
- **D:** On Discover, click invite icon on a creator card → conversation created, card shows "Invited".
- **E:** Visit `/c/[handle]` as a brand with matching open campaigns → info card shows campaign count and links.
