# Deal Flow Optimization — Design Spec

**Date:** 2026-09-02  
**Scope:** 5 optimizations to reduce friction in the brand→deal lifecycle  
**Schema changes:** None  
**Estimated files touched:** 6–8

---

## Problem

Brands experience three friction points in the deal lifecycle:

1. **Context loss at handoff** — Inbox conversations and deal threads are separate. When an offer is accepted, the deal starts with no message history. The brief placeholder says "Agreed in conversation — see the thread."
2. **Fragmented entry points** — Three paths to a deal (Discover→Chat→Offer, Campaign→Accept, Storefront→Book) each have different UIs and different levels of brief completeness.
3. **High-value actions buried** — "Send offer" is below the message history in inbox. Dashboard deal rows are read-only links. Inbox is missing from mobile nav.

---

## A. Unified Thread — Show Conversation History in Deal View

**Goal:** When a deal originates from an inbox conversation, show that conversation's messages inside the deal page so the brand never needs to flip back to inbox.

**How:**
- On `/deals/[id]`, check if the deal was created via an offer (offers table has `conversation_id`).
- If so, fetch messages where `conversation_id = offer.conversation_id`.
- Render as a collapsible "Pre-deal discussion" section above the deal's own message thread.
- Messages are **read-only** in this view — new messages go to the deal thread.
- Visual separator between conversation history and deal messages (e.g., a divider with "Deal started" label).

**Data flow:**
```
deal → offers (where deal_id) → conversation_id → messages (where conversation_id)
```

**Files:**
- `app/(dashboard)/deals/[id]/page.tsx` — add query for conversation messages, render collapsible section

**Edge cases:**
- Deals from direct booking or campaign acceptance have no conversation — section simply doesn't render.
- Multiple offers may exist on a conversation; use the offer that created this specific deal.

---

## B. Inline Deal Actions from Dashboard

**Goal:** Let brands take quick actions on deals directly from the dashboard without navigating to the deal detail page.

**What to surface:**
| Deal status | Action button | Server action |
|-------------|--------------|---------------|
| `submitted` | "Review preview" | Links to deal page scrolled to preview section |
| `published` | "Approve" | Same `transitionDeal` action used in deal page |
| `revision_requested` | "View preview" | Links to deal page |
| `requested` (brand-created) | "Waiting…" label | No action, informational |

**Constraint:** Only surface non-destructive, low-risk actions inline. "Cancel", "Dispute", and "Request revision" stay on the detail page where the brand has full context.

**Files:**
- `app/brand/page.tsx` — add conditional action buttons to deal rows

---

## C. Standardize the Brief Across All Three Paths

**Goal:** Every deal gets the same brief structure (`goals`, `product_description`, `talking_points`) regardless of how it was created.

**Current state:**
| Path | goals | product_description | talking_points |
|------|-------|-------------------|----------------|
| Direct booking | From form | From form (pre-filled with brand products) | From form |
| Campaign accept | Empty or campaign desc | Empty | Empty |
| Offer accept | "Agreed in conversation — see the thread." | Empty | Empty |

**Target state:**
| Path | goals | product_description | talking_points |
|------|-------|-------------------|----------------|
| Direct booking | From form | From form | From form |
| Campaign accept | Campaign description | Auto-fill from brand products | Creator's pitch text |
| Offer accept | Offer note (scope field) | Auto-fill from brand products | Empty (conversation visible via A) |

**How:**
- Modify `accept_campaign_application()` to map: `goals = campaign.description`, `product_description = brand_products joined`, `talking_points = application.pitch`.
- Modify `accept_offer()` to map: `goals = offer.note`, `product_description = brand_products joined`.
- "Auto-fill from brand products" = query `brand_products` for the brand and concatenate names as a comma-separated string. Simple, no new UI.

**Files:**
- Server action or RPC for `accept_campaign_application` — add field mapping
- Server action or RPC for `accept_offer` — add field mapping

---

## D. Promote Offer Action in Inbox

**Goal:** Make "Send offer" the primary CTA in a conversation, not buried below messages.

**Current:** Offer form sits at the bottom of the conversation page, below all messages and existing offers.

**New layout:**
- When conversation status = `accepted` and no pending offer:
  - Show a sticky "Make an offer" button in the conversation header area (next to creator name/status)
  - Button opens the offer form as a **sheet/modal** overlay
  - Form content is identical — select offering, set price, add note
- When a pending offer exists: show offer status badge in the header instead ("Offer pending — $X")

**Files:**
- `app/(dashboard)/inbox/[id]/page.tsx` — move offer CTA to header, extract form to modal/sheet
- May need to extract offer form into a separate component if currently inline

---

## E. Fix Mobile Nav — Add Inbox

**Goal:** Inbox is the primary communication channel but has no mobile nav tab. Fix this.

**Current mobile nav (5 tabs):**
Home | Discover | ✦ New Campaign | Deals | Alerts

**New mobile nav (5 tabs):**
Home | Discover | Inbox | Deals | ✦ More

**Changes:**
- Inbox gets its own tab (MessageSquare icon) with unread conversation count badge
- "Alerts" (notifications) moves to the bell icon in the mobile header (already exists on desktop, needs mobile visibility)
- "New Campaign" moves to a "More" or "+" floating action button, or into the Home/Discover page as a CTA. It's a low-frequency action that doesn't warrant a permanent nav slot.

**Files:**
- `MobileNav` component — restructure tabs
- Mobile layout/header — ensure notification bell renders on mobile

---

## Out of Scope

- Merging inbox and deal threads into a single unified thread (too large; A gives 80% of the benefit)
- Redesigning the three entry paths into one (medium-term; C normalizes the output)
- Payment integration or escrow changes
- Creator-side optimizations (this spec is brand-only)

---

## Testing Approach

Each optimization is independently testable:
- **A:** Navigate to a deal created from an offer → conversation history appears
- **B:** Dashboard shows action buttons → clicking "Approve" transitions the deal
- **C:** Accept a campaign application → deal brief has all three fields populated
- **D:** Open an accepted conversation → "Make an offer" button visible in header
- **E:** Mobile view → Inbox tab visible, notifications accessible from header
