# Clipline Copy Audit

All static user-facing text, organized by page/route. Use this to revamp copy with intentional messaging.

---

## Landing Page (`/`)
**File:** `app/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Book video creators. Skip the DM chaos." | Hero heading | |
| "Creators list real offerings at real prices. Brands book with a brief and track every deal from accepted to published, with anti-ghosting timers and reviews on both sides." | Hero body | |
| "Get started free" | Primary CTA | |
| "See a live storefront" | Secondary CTA | |
| "Free for creators. You keep 100% of your rate." | Sub-CTA note | |
| "Anti-ghosting timers" | Trust badge | |
| "Mutual reviews" | Trust badge | |
| "For creators" | Section heading | |
| "A storefront that makes you look like a business, not a DM. Set your formats and prices once; every booking arrives with a structured brief, a deadline, and a revision cap you chose." | Creator value prop | |
| "Productized offerings: dedicated videos, integrations, UGC" | Bullet | |
| "A deal pipeline instead of spreadsheet archaeology" | Bullet | |
| "Reviews that compound into your public rating" | Bullet | |
| "For brands" | Section heading | |
| "Find vetted video creators by niche, country, format, and budget. Book in two minutes with a brief the creator can actually execute, then watch the deal move step by step." | Brand value prop | |
| "Transparent pricing on every storefront" | Bullet | |
| "Preview before publish, revisions built in" | Bullet | |
| "Anti-ghosting timers on every deal" | Bullet | |
| "How a deal runs" | Section heading | |
| "Four steps, fully tracked. No side-channel chaos." | Section description | |
| "Book" / "Pick an offering, send a brief. The price is the price." | Step 1 | |
| "Create" / "The creator accepts, produces, and submits a preview link." | Step 2 | |
| "Approve" / "Request changes within the revision cap, or approve the live post." | Step 3 | |
| "Review" / "Both sides rate the collab. Ratings build the public record." | Step 4 | |
| "Every day without a storefront is a deal lost." | Closing band heading | |
| "Creators who wait lose bookings to those who don't. Brands miss vetted creators while scrolling DMs." | Closing band body | |
| "Don't miss out -- sign up free" | Closing CTA | |
| "Find creators" / "Become a creator" / "Log in" / "Terms" / "Privacy" / "Refunds" | Footer links | |

---

## Auth

### Login (`/login`)
**File:** `app/(auth)/login/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Welcome back" | Page heading | |
| "Email" | Form label | |
| "Password" | Form label | |
| "Log in" | Submit button | |
| "Don't have an account? Sign up" | Link text | |

### Signup (`/signup`)
**File:** `app/(auth)/signup/page.tsx` + `signup-form.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Don't let your next collab die in DMs." | Tagline | |
| "Free for creators. You keep 100% of your rate." | Sub-tagline | |
| "What brings you here?" | Form heading | |
| "Pick what matters and we'll tailor your setup." | Form description | |
| "A brand invited you -- sign up and your conversation opens automatically." | Invite banner | |
| "Already have an account? Log in" | Link text | |

---

## Creator Onboarding

### Step 1: Profile (`/onboarding/profile`)
**File:** `app/onboarding/profile/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Claim your handle" | Step label | |
| "Handle" / "Bio" / "Niches" / "Country" / "Languages" | Form labels | |
| "Save and continue" | Submit button | |

### Step 2: Socials (`/onboarding/socials`)
**File:** `app/onboarding/socials/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Add your socials" | Step label | |
| "Add the accounts where you post video content." | Description | |
| "Platform" / "Handle or profile link" | Form labels | |
| "Add account" | Submit button | |

### Step 3: Offerings (`/onboarding/offerings`)
**File:** `app/onboarding/offerings/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "What you offer" | Step label | |
| "Productize what brands can book from your storefront." | Description | |
| "Type" / "Title" / "Description" / "Price" / "Turnaround (days)" / "Revisions included" | Form labels | |
| "Add offering" | Submit button | |

### Step 4: Portfolio (`/onboarding/highlights`)
**File:** `app/onboarding/highlights/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Show your best work" | Step label | |
| "Link the videos you're proudest of. Brands see these when browsing your profile." | Description | |
| "Video link" / "Caption (optional)" | Form labels | |

### Step 5: Publish (`/onboarding/publish`)
**File:** `app/onboarding/publish/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Go live" | Step label | |
| "Publishing makes your storefront public to all brands on Clipline." | Description | |
| "You need to complete these before publishing:" | Requirement intro | |
| "Publish storefront" / "You're live! Back to dashboard" | Conditional buttons | |
| "Preview storefront" | Link | |

### Wizard Progress (`components/onboarding/wizard-shell.tsx`)

| Text | Type | Notes |
|------|------|-------|
| "Step {n} of 5" | Progress label | |
| "{pct}% complete" | Progress percentage | |

---

## Creator Dashboard

### Main (`/dashboard`)
**File:** `app/dashboard/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Your studio" | Page heading | |
| "Earned on Clipline" | Stat label | |
| "Active deals" | Stat label | |
| "Brand rating" | Stat label | |
| "Recent deals" | Section heading | |
| "No bookings yet." | Empty state heading | |
| "Offers you accept appear here." | Empty state description | |
| "Get started checklist" | Checklist heading | |
| "Profile complete" / "Socials linked" / "Offerings added" / "Portfolio added" / "Profile published" | Checklist items | |

### Profile (`/dashboard/profile`)
**File:** `app/dashboard/profile/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Your creator profile" | Page heading | |
| "Handle" / "Bio" / "Niches" / "Country" / "Languages" | Form labels | |
| "Tell creators about yourself" | Placeholder | |
| "Publish storefront" / "Unpublish" | Conditional buttons | |

### Offerings (`/dashboard/offerings`)
**File:** `app/dashboard/offerings/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Your offerings" | Page heading | |
| "What you'll deliver and at what price." | Description | |
| "Add an offering" | Section heading | |
| "Type" / "Title" / "Description" / "Price" / "Turnaround (days)" / "Revisions included" | Form labels | |
| "Add offering" | Submit button | |
| "Hide" / "Activate" / "Delete" | Action buttons | |

### Portfolio (`/dashboard/portfolio`)
**File:** `app/dashboard/portfolio/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Your portfolio" | Page heading | |
| "Link the videos you're proudest of. Brands see these when browsing your profile." | Description | |
| "Add a video" | Section heading | |
| "Video link" / "Caption (optional)" | Form labels | |
| "Add video" | Submit button | |
| "No portfolio yet." | Empty state heading | |
| "Link your best videos above." | Empty state description | |

---

## Public Creator Storefront (`/c/[handle]`)
**File:** `app/c/[handle]/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Clipline" | Logo/header | |
| "Find more creators" | Nav link | |
| "Audience" | Section heading | |
| "This creator hasn't linked social accounts yet." | Empty state | |
| "followers" / "avg views" / "engagement" | Stat labels | |
| "Public stats -- updated {date}" | Timestamp | |
| "Stats unavailable" / "Stats syncing..." | Status labels | |
| "Offerings" | Section heading | |
| "No offerings listed yet." | Empty state | |
| "Dedicated video" / "Integration (60-90s)" / "Short-form post" / "UGC video (no posting)" | Type labels | |
| "Brand reviews" | Section heading | |
| "Recent work" | Section heading | |
| "Book this for ${price}" | Book CTA | |
| "Book now" / "From ${price}" / "{n}d delivery" | Mobile CTA strip | |

---

## Booking (`/book/[offeringId]`)
**File:** `app/book/[offeringId]/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Book: {title}" | Page heading | |
| "by @{handle}" | Attribution | |
| "{n}-day delivery included" | Feature bullet | |
| "{n} revision(s) included" | Feature bullet | |
| "Direct creator communication" | Feature bullet | |
| "Preview before publish" | Feature bullet | |
| "Payment is handled outside the platform for now. You and the creator agree on payment directly. The deal tracker keeps both sides honest." | Info banner | |
| "Goals: what does success look like?" | Form label | |
| "Product / service description" | Form label | |
| "Key talking points" | Form label | |
| "Send booking request -- ${price}" | Submit button | |

---

## Discover (`/discover`)
**File:** `app/discover/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Find video creators" | Page heading | |
| "Real offerings, transparent prices, verified-or-labeled stats." | Description | |
| "New creators" / "Worked with" | Tab labels | |
| "Search by name, handle, or bio" | Search placeholder | |
| "Niche -- e.g. gaming" | Filter placeholder | |
| "Country" | Filter placeholder | |
| "Any format" | Select default | |
| "Filtered from your brand preferences." | Info text | |
| "show everyone" | Link | |
| "gaming" / "food" / "beauty" / "tech" / "fitness" / "lifestyle" / "fashion" / "finance" | Quick filters | |
| "Save this search as..." | Input placeholder | |
| "{n} creator(s) found" | Results count | |
| "Tick creators to invite with your reachout template" | Info text | |
| "No past collaborators yet." / "Creators you complete deals with appear here." | Empty state (worked-with tab) | |
| "No creators match those filters yet." / "Try widening the price range or clearing a filter." | Empty state (search) | |
| "Clear all filters" | Button | |
| "Invite selected" | Submit button | |
| "From ${price}" / "{n} offering(s)" / "No offerings listed" | Card details | |
| "Page {n} of {total}" / "Previous" / "Next" | Pagination | |

---

## Brand

### Dashboard (`/brand`)
**File:** `app/brand/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Find creators" | CTA button | |
| "Open inbox" | Link | |
| "Contacted" / "In progress" / "Completed" / "Blocked" | Stat labels | |
| "Contacted creators" | Section heading | |
| "Arrangements in progress" | Section heading | |
| "Completed" | Section heading | |
| "Blocked creators" | Section heading | |

### Onboarding (`/brand/onboarding`)
**File:** `app/brand/onboarding/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "33% complete" | Progress | |
| "Tell us about your brand" | Page heading | |

### Settings (`/brand/settings`)
**File:** `app/brand/settings/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Brand settings" | Page heading | |
| "Import from your website" | Section heading | |
| "We'll read your site and pre-fill your description, niches, and products." | Description | |
| "Brand profile" | Section heading | |
| "How creators see your brand when you reach out or book." | Description | |
| "Products" | Section heading | |
| "The products creators will feature in their videos." | Description | |
| "+ Add a product" | Toggle link | |
| "Product name" / "Product URL (optional)" / "Short description (optional)" | Form labels | |
| "Add product" / "Remove" | Buttons | |
| "Invite creators" | Section heading | |
| "Generate a personal join link. When they sign up through it, a conversation opens automatically." | Description | |
| "Their handle or email (for your records)" | Placeholder | |
| "Create invite" | Submit button | |
| "Joined" / "Waiting" | Status badges | |

### Brand Profile Form (`components/brand/brand-profile-form.tsx`)

| Text | Type | Notes |
|------|------|-------|
| "Company name" | Form label | |
| "Acme Skincare" | Placeholder | |
| "Website" | Form label | |
| "What your brand is about" | Form label | |
| "What you sell, who it's for, and the tone you go for." | Placeholder | |
| "Creator matching" | Section label | |
| "Content niches (comma-separated, up to 8)" | Form label | |
| "Formats" | Label | |
| "Message template" | Form label | |
| "Hi! We love your work and would like to collaborate on..." | Placeholder | |
| "Sent when you reach out to creators from Discover." | Help text | |
| "Brand guidelines" / "Rules for influencers" | Form labels | |
| "Shared with every creator you work with. PDF, Word, or text, up to 10 MB." | Help text | |
| "Anything else" | Form label | |
| "Anything creators or our matching should know, in your own words." | Placeholder | |
| "Save and start discovering" / "Save changes" | Conditional submit buttons | |

### Website Ingest (`components/brand/website-ingest.tsx`)

| Text | Type | Notes |
|------|------|-------|
| "Read my website" | Button | |
| "https://yourbrand.com" | Placeholder | |
| "Here's what we learned. Review below, then save." | Success message | |

---

## Deals

### List (`/deals`)
**File:** `app/deals/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Your deals" | Page heading | |
| "Action needed" / "In progress" / "Done" | Section headings | |
| "Nothing here." | Empty state | |

### Detail (`/deals/[id]`)
**File:** `app/deals/[id]/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Deliverables" / "Brief" / "Messages" / "Next steps" / "Timeline" | Section headings | |
| "Mark as paid" | Button | |
| "Leave a review" | Section heading | |

---

## Campaigns

### List (`/campaigns`)
**File:** `app/campaigns/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Campaigns" | Page heading | |
| "Active campaigns looking for creators like you." | Description (creator view) | |
| "Browse campaigns" / "Start a campaign" | Section headings (role-dependent) | |
| "No active campaigns right now." | Empty state (creator) | |
| "You haven't started a campaign yet." | Empty state (brand) | |
| "Start a campaign" | Form heading | |
| "Title" / "What you're looking for" / "Content type" / "Budget from (USD)" / "Budget to (USD)" / "Applications close (optional)" | Form labels | |
| "Create campaign" | Submit button | |

### Detail (`/campaigns/[id]`)
**File:** `app/campaigns/[id]/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Budget: ${min} -- ${max} USD" | Budget display | |
| "Applications" | Section heading | |
| "Your pitch" / "Your price (USD)" | Form labels | |
| "Accept" / "Decline" / "Close campaign" / "Reopen campaign" / "Withdraw application" / "Submit application" | Action buttons | |

---

## Inbox

### List (`/inbox`)
**File:** `app/inbox/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Inbox" | Page heading | |
| "Brand invitations" | Section heading | |
| "Conversations" | Section heading | |
| "Accept & chat" / "Decline" | Buttons | |

### Conversation (`/inbox/[id]`)
**File:** `app/inbox/[id]/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Offers" | Section heading | |
| "Offering" / "Agreed price (USD)" / "Scope note (optional, becomes the brief)" | Form labels | |
| "Draft a reply with AI" | Button | |
| "Block this creator" | Button | |

---

## Notifications (`/notifications`)
**File:** `app/notifications/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Notifications" | Page heading | |
| "All caught up" | Empty state heading | |
| "Invites, offers, and deal updates land here." | Empty state description | |

---

## Report (`/report`)
**File:** `app/report/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Report a problem" | Page heading | |
| "Creator or brand stopped responding" / "Deliverable quality issue" / "Payment dispute" / "Content doesn't match brief" / "Other" | Select options | |
| "Details" | Form label | |
| "Submit report" | Submit button | |

---

## Admin

### Dashboard (`/admin`)
**File:** `app/admin/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Admin" | Page heading | |
| "Disputed deals" / "Open reports" / "Creators" | Section headings | |
| "Suspend" / "Unsuspend (to draft)" | Action buttons | |

### Dispute (`/admin/deals/[id]`)
**File:** `app/admin/deals/[id]/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| "Resolve dispute" | Section heading | |
| "Release to creator (complete)" / "Refund brand (cancel)" | Action buttons | |
| "Brief" / "Messages" / "Timeline" | Section headings | |

---

## Navigation

### Top Nav (`components/site-nav.tsx`)

| Role | Links |
|------|-------|
| Creator | Dashboard, Campaigns, Inbox, Deals |
| Brand | Brand home, Discover, Campaigns, Inbox, Deals |
| Admin | Admin, Deals |

### Mobile Nav (`components/mobile-nav.tsx`)

| Role | Tabs |
|------|------|
| Creator | Studio, Inbox, New, Deals, Alerts |
| Brand | Home, Discover, New, Deals, Alerts |

---

## Auth Error (`/auth/error`)
**File:** `app/auth/error/page.tsx`

| Text | Type | Notes |
|------|------|-------|
| Error message from query param | Dynamic | |

---

## Legal Pages

### Terms (`/legal/terms`) | Privacy (`/legal/privacy`) | Refunds (`/legal/refunds`)

Full legal copy lives in `app/legal/*/page.tsx`. Review separately -- legal text has different quality bar than product copy.
