# Passionfroot UI/UX Reverse-Engineering Specification

## Executive Summary

Passionfroot is a dual-sided creator marketing platform with distinct **Creator** and **Partner/Brand** workspaces, plus public **Storefront** pages that act as intelligent media kits for creators. The authenticated app is structured around a **workspace shell with a left-hand navigation sidebar**, a **Home dashboard**, feature modules (Storefront, Discovery, Campaigns, Collaborations, Inbox, Calendar, Analytics, Payments, Settings), and an embedded AI agent surface called **Zest** that appears both as a dedicated view and a contextual popup. This report reconstructs the current UI/UX based on official documentation, live storefront examples, auth flows, and support content as of mid-2026.[^1][^2][^3][^4][^5][^6]

Each section clearly distinguishes between:

- **Verified from current UI** – observed in live workspace or storefront URLs.
- **Verified from official documentation** – explicitly described in Passionfroot Help Center, blog, or product pages.
- **Inferred** – deduced from patterns, wording, and modern SaaS conventions.
- **Historical** – older flows still mentioned but potentially evolved.
- **Not publicly verifiable** – where the implementation or visual details are not exposed.

The goal is to give a senior frontend engineer enough information to build a **high-fidelity functional clone** of the current Passionfroot interface, information architecture, interaction flows, and visual language.

***

## Current Product Architecture & User Roles

### User Roles

- **Creators** – individuals or teams who monetize channels (newsletter, podcast, YouTube, LinkedIn, TikTok, etc.) via sponsorships and products.[^2][^4]
- **Partners/Brands** – marketers, growth teams, founders running creator campaigns; they use Passionfroot for discovery, campaign planning, outreach, collaborations, payments, and analytics.[^3][^7]

Verified from official documentation.

### Surface Types

1. **Public Marketing Website** (`https://www.passionfroot.me/`) – marketing copy for Zest and the platform; not in scope for workspace cloning.[^8]
2. **Public Creator Storefront Pages** (e.g. `https://www.passionfroot.me/openpedia`) – configurable media kits with products, stats, and “Book now” CTAs.[^9]
3. **Creator Workspace** (`workspace.passionfroot.me` – Creator account) – left-sidebar app with Home, Storefront, Requests, Calendar, Products, Payments, Discover, Inbox, Partners, etc.[^10][^6]
4. **Partner Workspace** (`workspace.passionfroot.me` – Partner account) – similar shell but with Campaigns, Discovery, Collaborations, Analytics, Inbox, Payments, Zest, Live Campaigns views.[^5][^7][^3]
5. **Zest AI Surface** – dedicated tab plus popup chat accessible from any page; context-aware, integrated with campaigns, discovery, analytics.[^1]

Creator vs Partner workspace split is verified from docs; exact route segmentation under `/creator` vs `/partner` is inferred.

***

## Authentication & Onboarding Flows

### Login & Signup Screens

**Verified from current UI (auth pages):**

- **Login (Creator)** – `https://workspace.passionfroot.me/auth/login?redirectUrl=/` shows:
  - H1: “Sign in to your Creator account”.
  - Input: “Your email address”.
  - Link: “No account yet? Join now”.
  - Link: “Looking to book creators? Log in as a Partner”.
  - Section heading: “Welcome to Passionfroot” and a short value prop paragraph.[^11]

- **Signup** – `https://workspace.passionfroot.me/signup` shows:
  - H1: “First, let’s set up your account”.
  - Inputs: “Your name”, “Your email”, password rule text.
  - CTA: “Create account” with T&C acceptance copy.
  - Repeated “Welcome to Passionfroot” + tagline block.[^12]

**Inferred UI layout:**

- Two-column layout: left column auth form (~480–560px), right column marketing panel with heading, short copy.
- Centered card on desktop: card width ~520px, vertical spacing ~24–32px between form controls.
- Password field includes inline helper text about complexity.

**Authentication States:**

- Error state: inline error text below email/password when invalid; standard red text and border inferred.
- Loading state: disabled “Create account”/“Sign in” with spinner or subtle opacity change – inferred.

***

## Information Architecture – High-Level Navigation

### Creator Workspace Navigation

**Verified from official documentation:** The left sidebar for creators exposes:[^10]

- **Home** – “Home Screen” acts as the ultimate homepage with to-do cards (Collaborations, Payments).[^6]
- **Storefront** – view performance, share link, enter Storefront Editor.[^13][^6]
- **Partners** – CRM list of sponsors with last activity and contact details.[^6]
- **Calendar** – editorial + bookings calendar (Calendar 2.0), shows slots, collaborations, external bookings.[^14][^6]
- **Requests** – inbound sponsorship requests, with status groups (Pending, In Negotiation, Rejected).[^6]
- **Payments** – payment status overview and Stripe activation, invoices, weekly totals.[^10]
- **Discover** – creator-side Discover tab for Live Campaigns + brand directory (Passionfroot Partner Network).[^15][^6]
- **Inbox** – messaging and conversation cockpit with side panel for collab details.[^16][^17]

The documentation lists Storefront, Requests, Calendar, Products, Payments explicitly; Home, Partners, Discover, Inbox are described in the “Navigating your Workspace” article.[^10][^6]

**Inferred navigation tree for Creator workspace:**

```text
CreatorWorkspace
├── Home
├── Storefront
│   ├── Overview
│   └── Editor
├── Partners
├── Calendar
├── Requests
├── Products
├── Payments
├── Discover
├── Inbox
└── Settings (account, notifications, payments, integrations)
```

Settings and some sub-tabs are inferred based on typical SaaS patterns and scattered references (Partner Settings doc).[^18]

### Partner Workspace Navigation

**Verified from official documentation (for Partners):**[^7][^3][^5][^1]

- Features mentioned or implied:
  - **Home** – quick overview, campaign to-dos.
  - **Zest** – dedicated view for AI agent.
  - **Discovery** – Discovery Tab for creators, search assistant, filters, Match Score, side-view profile, Storefront tab.[^19][^5]
  - **Campaigns** – Campaigns tab for campaign creation, shortlist, statuses, exports.[^20]
  - **Collaborations** – Collaborations view: all creator partnerships, budget tracking, filters.[^21]
  - **Live Campaigns** – view of published briefs where creators apply.[^5]
  - **Inbox** – central messaging hub.[^21]
  - **Analytics** – Analytics tab with aggregation cards, performance table, filters.[^7]
  - **Payments / Wallet** – payment methods (card, bank transfer, FrootWallet) and to-dos.[^3]
  - **Settings** – Partner settings for workspace, user, notifications.[^18]

**Inferred navigation tree for Partner workspace:**

```text
PartnerWorkspace
├── Home
├── Zest
├── Discovery
│   ├── Search
│   ├── Results
│   └── CreatorProfileDrawer
├── Campaigns
├── Collaborations
│   ├── CampaignList
│   └── CollaborationTable
├── LiveCampaigns
├── Inbox
├── Analytics
├── Payments
│   ├── Wallet (FrootWallet)
│   └── Transactions
└── Settings
```

Breadcrumbs are not explicitly documented; likely minimal (“Campaigns / [Campaign Name]”) – inferred.

### Global Elements

**Verified or inferred:**

- **Workspace switching** – Partner Settings references “Currently on — the workspace your account is active in today”, suggesting a workspace switcher in the header or sidebar footer.[^18]
- **User menu** – standard avatar + dropdown for profile, logout (“logout button on the lower lefthand corner” for creators).[^10]
- **Global search** – Discovery search is obvious; global search across campaigns/collabs is not explicitly documented (not publicly verifiable).
- **Notifications** – Email notifications mentioned for inbox; in-app notification icon likely exists but not documented.[^16]

***

## Screen & State Inventory

The following tables list identifiable screens, modals, drawers, and major states. Routes are inferred based on workspace domain and feature naming.

### Table 1 – Selected Partner Screens & States

| Screen | Route (inferred) | User type | Parent | Entry points | Exit points | Purpose | Primary CTA | Secondary CTAs | Layout | Major components | Data displayed | Interactive elements | Loading/Empty/Error | Permissions | Mobile behavior |
|-------|-------------------|-----------|--------|-------------|------------|---------|------------|----------------|--------|------------------|---------------|----------------------|----------------------|------------|----------------|
| Partner Login | `/auth/login?redirectUrl=/partner` | Partner | none | Marketing site "For Brands" → Login; email link | Redirect to Home | Authenticate partner | Sign in | Log in as Creator, Forgot password | Centered auth card | Logo, heading, email input, magic link option | Email, login errors | Email field, submit button, switch-link | Loading spinner on submit; inline error text | Public | Stack form full-width, header collapses |
| Partner Home | `/partner/home` | Partner | Workspace | Post-login; nav sidebar "Home" | Navigate to other tabs | Overview of to-dos and earnings | Open to-do item | Open Zest, open campaign | Two-column main content | Summary cards: At a glance, Collaborations, Payments | Unread messages count, earnings total, to-do list items | Clicking to-do opens relevant collab/campaign; filters on cards | Empty state text "You’re on top of things"; skeleton cards while loading – inferred | Restricted to logged-in partners | Cards stack vertically, sidebar collapses |
| Discovery – Initial | `/partner/discovery` | Partner | Home | Nav: Discovery, Zest deep-link | Campaign view, creator profile drawer | Entry into search/discovery UX | Start search | Open Search Assistant | Main header + search bar + filters toolbar | Search input, channel filter, Add filter button, match score legend | None until search | Typed query input, search assistant trigger, filter chip interactions | Skeleton rows for result list; empty copy if zero results | Partner | Filters turned into dropdown; list becomes single-column |
| Discovery – Results | `/partner/discovery?query=…` | Partner | Discovery | Running search | Back to Discovery initial, open creator drawer | Browse creator list | Open creator profile | Save to campaign, Send proposal | Two-column: list left, drawer right | Creator cards, AI description, metrics columns, Match Score pill | Creator name, avatar, AI description, per-channel stats, match score | Hover to reveal actions; click opens drawer; bookmark icon; "Send proposal" or "Book" buttons | Loading skeleton rows; empty state message; filter error state if invalid – inferred | Partner; some filters require plan tier – inferred | Cards full-width list; drawer becomes full-screen modal |
| Creator Profile Drawer | `/partner/discovery#creatorId` | Partner | Discovery | Click creator card | Close drawer, open Storefront tab | Detailed profile for evaluation | Book product | Send Inquiry, Save to campaign | Side panel over right portion | Tabs: Overview, Storefront; sections: match score, description, channels, recent content, performance, audience, products, previous sponsors, rates | All creator stats; verified vs self-reported with blue check.[^19] | Tabs, buttons, proposal modal trigger, save/book actions | Loading skeleton for content blocks; error if stats not loadable; empty if missing metrics – inferred | Partner | Full-screen panel; back button at top |
| Zest – Dedicated View | `/partner/zest` | Partner | Workspace | Nav: Zest, quick prompt in Home | Close Zest or navigate away | Central AI agent for strategy, discovery, outreach, reporting | Start chat | Trigger prompts (Discover creators, Plan campaign, etc.) | Two-pane: chat column + context/results column – inferred from description | Chat window, message list, prompt chips, input box, side panel for outreach review.[^1][^5] | Campaign parameters, creator lists, reports summary | Typing messages, selecting quick prompts, uploading files, click to open side panel review | Streaming skeleton for answers; error bubble for failed requests; offline message – inferred | Partner | Chat expands full viewport, side panel overlays |
| Campaigns List | `/partner/campaigns` | Partner | Workspace | Nav: Campaigns, Zest → "Your campaign" card | Open specific campaign, back to Home | Manage campaign objects | New campaign | Filter campaigns | Table layout | Campaign rows with status, budget, description, counts | Name, budget, statuses, number of creators | Row click; new campaign button; filter dropdown | Skeleton table; empty state CTA "Create first campaign" – inferred | Partner | Table becomes cards list |
| Campaign Detail | `/partner/campaigns/[id]` | Partner | Campaigns | Row click, Zest created campaign | Back to campaigns, open Collaborations view | Review shortlist, budget, status | Add creator | Open outreach | Two-column: overview summary + creator list table | Summary card: budget, spend; creator shortlist table | Creator rows with status, notes, platform, audience, products | Status dropdown, notes field, export button, send request/proposal actions.[^20] | Loading state on table, empty state "Add creators"; error if export fails – inferred | Partner | Table scrolls horizontally; actions as stacked buttons |
| Collaborations View | `/partner/collaborations` | Partner | Workspace | Nav: Collaborations; from campaign detail "View collaborations" | Back to campaign; open Inbox | Track all collaborations and budget | Open collaboration | Filter by stage | Full-width table page | Filters row at top; table of collaborations | Creators, products, platforms, collab stage, budget, payment status.[^21] | Filter chips, sort headers, link to inbox, link to analytics | Skeleton table, empty state; error banner for fetch – inferred | Partner | Table collapses to cards |
| Inbox | `/partner/inbox` | Partner | Workspace | Nav: Inbox; from collab row "Open chat" | Back to any view | Central messaging & collaboration cockpit.[^22][^16] | Open conversation | Archive/unarchive | Three-column: conversations list, message thread, right side panel for collab/proposal/brief – inferred | Conversation list, message bubbles, timeline of collab events, side panel with collab history & quick actions.[^16] | Messages, events (proposal sent, assets submitted, invoice paid), attachments | Message composer, upload attachment, quick action "Send proposal", archive toggle.[^16] | Empty inbox message; loading spinner on list; error toast on send failure – inferred | Partner | List collapses; side panel becomes bottom sheet |
| Analytics | `/partner/analytics` | Partner | Workspace | Nav: Analytics; from Zest "Open analytics" | Back to other tabs | Performance reporting across creators/posts/collabs.[^7] | Adjust filters | Start Zest report | Header with filters; aggregation cards row; performance table below.[^7] | Filter bar, Display button, cards, table columns | Reach, Engagement, Engagement Rate, Spend; per-collab metrics; URLs | Filters, sort, column chooser, link edit, external collab add | Skeleton cards; sticky loading row; message for missing metrics; error toast for failed fetch.[^7] | Partner | Cards stack; table scrolls; filters as dropdowns |
| Live Campaigns | `/partner/live-campaigns` | Partner | Collaborations | From Collaborations campaign detail → Publish; left nav "Live Campaigns".[^5] | Back to collaborations | Publish and manage open campaign briefs | Publish campaign | Review applications | Page-level list of Live Campaigns; inside, tabs for Applicants, Overview – inferred | Campaign cards with status; within campaign: Applicants tab with list & actions | Applicants with status indicators and options (Interested, Save, Decline).[^5] | Status actions, publish button, restriction filters | Empty state "No live campaigns"; loading skeleton – inferred | Partner | Applicants list vertical stack; bottom sheet for application details |
| Payments / Wallet | `/partner/payments` | Partner | Workspace | Nav: Payments; from Inbox to-dos | Navigate to Analytics or collab | Initiate and track payments | Pay creator | View wallet | Layout: filters + table; wallet summary widget – inferred | Transaction list, wallet balance, pending amounts | Payment method, amount, due dates | Pay now, view invoice, refund; filter by status | Skeleton rows; empty; error when Stripe unavailable – inferred | Partner | Table to cards; wallet summary top |
| Settings | `/partner/settings` | Partner | Workspace | User menu; link in sidebar | Back to workspace | Configure workspace, notifications, payment defaults | Save | Cancel | Form layout | Workspace list, roles, email, notifications toggles.[^18] | Current workspace, email, etc. | Inputs, selects, toggles | Inline validation errors; success toast; error toast – inferred | Partner | Fields full-width |

The above combines verified documentation with inferred layout and component structures.

### Table 2 – Creator Screens & States

Key creator views documented in "Navigating your Workspace" and FAQs.[^6][^10]

| Screen | Route (inferred) | User type | Parent | Entry points | Exit points | Purpose | Primary CTA | Secondary CTAs | Layout | Major components | Data displayed | Interactive elements | Loading/Empty/Error | Permissions | Mobile behavior |
|-------|-------------------|-----------|--------|-------------|------------|---------|------------|----------------|--------|------------------|---------------|----------------------|----------------------|------------|----------------|
| Creator Home | `/creator/home` | Creator | Workspace | Post-login | Nav to other tabs | Overview of sponsorship to-dos and earnings | Open to-do | Open calendar | Cards similar to partner Home but creator-centric.[^6] | At a glance card, collaborations to-dos, payments to-dos | Unread messages, weekly totals, actions | Click to open request, collab, payment | Skeleton cards; empty state "You’re on top of things" – inferred | Creator | Cards stack |
| Storefront Overview | `/creator/storefront` | Creator | Workspace | Nav: Storefront | Editor | Track storefront performance & sharing | Edit storefront | Copy link, share | Split: performance metrics + preview + Editor entry.[^6][^13] | Stats summary, preview iframe, "Edit Storefront" button | Views, bookings, products, channels | Buttons, share controls | Loading preview skeleton; empty if not yet published – inferred | Creator | Preview collapses; metrics below |
| Storefront Editor | `/creator/storefront/editor` | Creator | Storefront | "Edit Storefront" | Back to overview | Build media kit using blocks | Add block | Save changes | Canvas column + right sidebar inspector + top "+ Add" toolbar.[^4][^13] | Block list (channel, sponsorship, link, content blocks) | Channel descriptions, stats, products, packages, content sections | Drag-and-drop blocks, block settings, stats inputs, live stats connection toggles | Skeleton loader for stats; error messages for verification; empty state "Add your first block".[^13] | Creator | Single-column; block editing modals instead of sidebars |
| Requests | `/creator/requests` | Creator | Workspace | Nav: Requests | Collab page, Inbox | Manage inbound sponsor requests | Open request | Accept, Reject, Send proposal | Table or cards grouped by Pending, In Negotiation, Rejected.[^6] | Request cards, status badges | Partner name, requested product, date | Accept/Reject buttons, send proposal action | Skeleton; empty message; error banner – inferred | Creator | Cards full-width |
| Calendar | `/creator/calendar` | Creator | Workspace | Nav: Calendar | Back to workspace | Central calendar for slots, collaborations, external bookings.[^14][^10] | Add slots | Open collaboration | Month view grid with top summary of weekly totals.[^14] | Calendar grid, slot markers, collaboration blocks, external booking items | Date, channel, product, status, value per slot; weekly total.[^10][^14] | Hover tooltips, click to open collab, "➕ Add an item" for external booking.[^14] | Loading of items; empty state message; error banner if unable to fetch – inferred | Creator | Switch to agenda list or week view; tap to open bottom sheet |
| Products | `/creator/products` | Creator | Workspace | Nav: Products | Storefront Editor, Calendar | Edit channels, products, prices.[^10] | Save | Add product | Form/table layout | Channel/product rows | Channel name, product name, price, placements per slot | Inputs, toggles for price visibility, placements | Inline validation; empty state message – inferred | Creator | Cards layout |
| Payments | `/creator/payments` | Creator | Workspace | Nav: Payments | Stripe onboarding | Track payments & enable Stripe.[^10][^23] | Connect with Stripe | View dashboard | Layout: status summary + Stripe connect card + transaction list | Payment dashboard widget, transaction table | Money on the way, total earnings, transactions.[^10] | Connect button, filter controls, void invoice button.[^10] | Loading; empty; error when Stripe unavailable – inferred | Creator | Table to cards |
| Discover (Creator-side) | `/creator/discover` | Creator | Workspace | Nav: Discover | Inbox | Browse Live Campaigns and brands.[^15][^6] | Apply to campaign | Connect with brand | Cards grid | Live Campaign cards; Partner Network brand cards | Brief text, budget, platforms, timelines, connect limits.[^15] | Apply button, Connect button | Empty when not eligible; grayed-out Discover when Stripe not set; troubleshooting messages.[^15] | Creator | Cards stack |
| Inbox & Messaging | `/creator/inbox` | Creator | Workspace | Nav: Inbox | Back to workspace | Manage conversations & proposals.[^16] | Send message | Send proposal | Three-column with side panel (same pattern as partners).[^16] | Conversation list, message thread, side panel (collab history, quick actions) | Messages, events, attachments | Composer, upload attachment, quick action proposal, archive button.[^16] | Email notification fallback if unread >60s; empty archived tab; error states – partially verified/inferred.[^16] | Creator | List collapses; side panel bottom sheet |

### Public Storefront States

**Verified from current UI (`/openpedia`):** Storefront page sections and interactive elements:[^9]

- Hero with creator brand name + description.
- “Previous partnerships” with brand logos and names.
- Multiple **Stats blocks** for newsletter, website, X/Twitter, LinkedIn, etc. Each includes metrics like subscribers, CTR, open rate, locations, gender, age, impressions, followers.
- Multiple **Product cards** grouped under sections (e.g. "Let’s work together"). For each:
  - Price (e.g. `$500`, `$99`, `$250`).
  - Description text specifying placement and format.
  - CTA button "Book now".
- Packages section with multi-line breakdown (list of included products with quantity and labels).
- Footer: "Built with Passionfroot" + Privacy Policy link.

**Inferred layout:**

- Max content width ~960–1040px.
- Grid: 12 columns, with stats and product blocks arranged in 2–3 column cards, stacked on mobile.
- CTA style: filled button using brand primary color (#FF9966 or similar).[^24]

***

## Visual Design System

### Typography

No explicit font name is documented, but the visual style from help center and storefront suggests a modern humanist/geometric sans similar to **Inter** or **Satoshi**. Font selection is **inferred**.[^25][^26]

**Recommended for clone:**

- **Font family:** `"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;` – inferred choice.
- **Heading hierarchy (estimated):**
  - H1: 32px, 700 weight, line-height 1.2.
  - H2: 24px, 600 weight, line-height 1.3.
  - H3: 20px, 600 weight.
  - H4: 16px, 600 weight.
- **Body text:** 14–16px, 400–500 weight; line-height ~1.5.
- **Caption text:** 12–13px, 400 weight.
- **Text transformations:** Mostly sentence case; badge labels might be uppercase with tracking ~0.04em – inferred.

Mark all font size/weight values as estimates for clone fidelity.

### Color System

Brand color references show Passionfroot palette including **Atomic Tangerine (#FF9966)** and neutral tones like near-black and off-white.[^24]

**Verified from brand colors reference (approximate):**[^24]

- Primary: `#FF9966` (Atomic Tangerine).
- Neutral dark: `#1B1C1D` (Shark).
- Background light: `#F5F3EA` (Spring Wood).

**Inferred full token table:**

- `color-primary`: `#FF9966` – main accent (buttons, highlights).
- `color-secondary`: `#DEB80B` – warm yellow accent (for badges, highlight states).[inferred from similar palettes][^27]
- `color-accent`: `#7C2142` – deep burgundy accent for premium or error states.[inferred][^27]
- `color-background`: `#F5F3EA` or `#FFFFFF` for workspace.
- `color-surface`: `#FFFFFF` for cards and tables.
- `color-surface-elevated`: `#F9F7F0` for modals and panels.
- `color-border`: `#E0E0E5` – light grey borders (1px).
- `color-divider`: `#F0EEF5` – table row dividers.
- `color-text-primary`: `#1B1C1D`.
- `color-text-secondary`: `#4B4C50`.
- `color-text-muted`: `#8B8C90`.
- `color-success`: `#2E9D64`.
- `color-warning`: `#DEB80B`.
- `color-error`: `#D14343`.
- `color-info`: `#2563EB`.
- `color-disabled`: `#C2C3C8`.

All but the three brand colors are inferred approximations.

### Spacing Scale

From screenshots and typical SaaS patterns, Passionfroot appears to use a **4px-based spacing scale**.

**Inferred spacing tokens:**

- `space-1`: 4px.
- `space-2`: 8px.
- `space-3`: 12px.
- `space-4`: 16px.
- `space-5`: 24px.
- `space-6`: 32px.
- `space-7`: 40px.
- `space-8`: 48px.

Cards and page sections likely use 24–32px padding; form fields and row gutters 8–16px.

### Borders & Radii

Rounded corners are visible on storefront cards and typical marketing visuals; help center references do not show workspace UI, but modern SaaS likely uses consistent radii.

**Inferred radii:**

- `radius-sm`: 4px – inputs, pills.
- `radius-md`: 8px – buttons, cards.
- `radius-lg`: 12px – modals, large cards.
- `radius-round`: 50% – avatars.

Border widths:

- `border-thin`: 1px.
- `border-thick`: 2px (focus ring, selected filters).

These values are inferred to mimic the visual style.

### Shadows / Elevation

Given marketing examples about "UI animations & interaction patterns" and typical SaaS design, the following is inferred:

- **Card elevation:** subtle box-shadow `0 4px 12px rgba(0,0,0,0.06)`.
- **Modal elevation:** stronger shadow `0 12px 32px rgba(0,0,0,0.16)`.
- **Dropdown/Popover:** `0 8px 24px rgba(0,0,0,0.12)`.

No direct documentation; not publicly verifiable.

### Icons

No explicit icon library is documented; likely uses simple line icons (24px) consistent with Inter/Satoshi aesthetic – inferred.

Recommended for clone:

- Use **Lucide** or **Heroicons outline** with 1.5px–2px stroke.
- Icon sizes: 16px for inline text, 20–24px for navigation.
- Icons placed left in buttons and within filter chips where relevant (e.g., filter icon, calendar icon).

Icon library is not publicly verifiable, so any choice should be marked as implementation recommendation.

***

## Layout Geometry & CSS Concepts

### Application Shell

**Inferred from workspace patterns and help center language:**

```text
Viewport
│
├── Sidebar: ~240px fixed width on desktop
│   ├── Logo + product name
│   ├── Primary nav items (Home, Storefront, Discovery, etc.)
│   ├── Divider
│   ├── Secondary nav items (Settings, Help)
│   └── Workspace switcher + logout
│
└── Main
    ├── Header (~64px height)
    │   ├── Page title
    │   ├── Contextual actions (New campaign, Edit storefront)
    │   ├── Zest button / popup trigger
    │   └── User menu, notifications
    ├── Page container (max-width ~1120px, centered)
    │   ├── Toolbar (filters, tabs)
    │   └── Content (tables, grids, cards)
```

**Approximate measurements:**

- **Sidebar width:** 232–256px.
- **Header height:** 56–64px.
- **Page content padding:** 24px top, 24–32px horizontal.
- **Card padding:** 16–24px.
- **Table row height:** 48–56px.
- **Form field height:** 40–44px.
- **Primary button height:** 40–44px.

Values are inferred from typical SaaS design and should be tuned during implementation.

### Discovery Page Layout

Based on creator profile documentation, Discovery likely uses a **two-column layout**:[^19]

```text
DiscoveryPage
├── AppShell
│   ├── Sidebar
│   └── TopBar
│
└── Main
    ├── PageHeader (title, description)
    ├── SearchToolbar
    │   ├── SearchInput (AI-powered)
    │   ├── ChannelSelect
    │   ├── AddFilterButton
    │   └── MatchScoreLegend
    ├── Content
        ├── CreatorList (left ~60%)
        └── CreatorProfileDrawer (right ~40%)
```

Approximate widths:

- Creator list column: ~60–64% of content width.
- Drawer width: ~36–40% (min 320–360px).

***

## Component Inventory

The following table lists reusable components with purpose, variants, and key props. Most are inferred from documentation.

### Core Shell Components

| Component | Purpose | Variants | Key props/data | States | Interaction | Responsive |
|-----------|---------|----------|----------------|--------|------------|-----------|
| Sidebar | Global navigation | Creator, Partner | `items`, `activeItem`, `workspace`, `userRole` | Collapsed, expanded | Click to navigate; hover highlights | Collapses to icon-only or top nav on mobile |
| TopBar | Page-level header | With Zest trigger, without | `title`, `actions`, `breadcrumbs` | Sticky, scrolled | Zest popup open/close; user menu dropdown | Becomes compact sticky header |
| WorkspaceSwitcher | Switch between workspaces | None | `workspaces`, `currentWorkspace` | Dropdown open/close | Select workspace | Full-width dropdown |

### Input & Filter Components

| Component | Purpose | Variants | Props | States | Interaction |
|-----------|---------|----------|-------|--------|------------|
| TextInput | Basic input | Standard, with icon | `value`, `placeholder`, `onChange`, `type` | Focused, error, disabled | Standard typing | Full-width on mobile |
| SearchBar | Discovery search | With Search Assistant button | `query`, `onSearch`, `onOpenAssistant` | Empty, with query, loading | Debounced search, assistant trigger | Stacks vertically |
| FilterChip | Quick filters | Selected, unselected | `label`, `selected`, `onToggle` | Hover, selected | Toggle | Wraps |
| SelectDropdown | Filter selects | Single, multi | `options`, `value`, `onChange` | Open/closed | Click to open, item select | Full-width dropdown |

### Cards & Tables

| Component | Purpose | Variants | Props | States | Screens |
|-----------|---------|----------|-------|--------|--------|
| CreatorCard | Creator preview | Compact, detailed | `creator`, `matchScore`, `channels`, `metrics` | Hovered, selected, saved | Click opens drawer; bookmark toggles | Discovery |
| CampaignCard | Campaign summary | Live vs internal | `campaign`, `status`, `budget` | Hovered | Click to open detail | Home, LiveCampaigns |
| StatCard | Analytics summary | Reach, Engagement, Spend | `label`, `value`, `trend` | Loading, error | None (read-only) | Analytics |
| Table | Generic data table | Bordered, striped | `columns`, `rows`, `onSort`, `onRowClick` | Loading, empty | Sort, filter, paginate | Collapses to cards |

### Messaging Components

| Component | Purpose | Variants | Props | States | Screens |
|-----------|---------|----------|-------|--------|--------|
| ConversationList | Shows chats | With grouped sections | `conversations`, `activeConversationId` | Loading, empty, archived | Click to select | Inbox |
| MessageThread | Chat messages | With events timeline | `messages`, `events` | Streaming, sending, error | Scroll, link clicks | Inbox |
| MessageComposer | Input area | With attachments | `onSend`, `onUpload` | Disabled when sending | Enter to send, attach | Inbox |
| CollaborationSidePanel | Right panel | Tabs: Requests, Briefs, Proposals | `collaborations` | Open/closed | Tab switching, quick actions | Inbox |

### Storefront Components

| Component | Purpose | Variants | Props | States | Screens |
|-----------|---------|----------|-------|--------|--------|
| StorefrontHero | Top identity area | None | `title`, `subtitle`, `avatar`, `channels` | Published/unpublished | None | Storefront |
| StatsBlock | Metrics display | Channel vs platform | `stats`, `verified` | Loading | Tooltip for verification | Storefront |
| ProductCard | Sponsorship product | Single, package | `name`, `price`, `description`, `includes` | Selected, disabled | "Book now" click triggers proposal/request form | Storefront |
| PackageBreakdown | Detailed packages | None | `items` | None | None | Storefront |

Detailed props can be refined during implementation.

***

## State Machine Analysis – Key Flows

### Discovery (Partner) State Machine

Verified and inferred from Discovery docs.[^5][^19]

States:

1. **Initial** – Discovery tab opened; no query.
2. **Searching** – Partner types query or uses Search Assistant; filters applied.
3. **Results** – Creator list populated; Match Scores visible.
4. **CreatorSelected** – Partner clicks a creator; side-view profile opens.
5. **ProfilePanelOpen** – Creator profile drawer showing overview.
6. **StorefrontTab** – Toggle to creator’s storefront media kit.
7. **SavedToCampaign** – Bookmark icon used; campaign selected/created.[^5]
8. **AddToCampaignState** – Campaign updated with creator.
9. **OutreachModalOpen** – Partner clicks "Send proposal" or "Book"; proposal modal opens.[^5]
10. **OutreachSent** – Request/Inquiry sent; chat created.[^19][^5]
11. **ErrorState** – Failure to send outreach (network, validation) – inferred.

Transitions (simplified):

- Trigger: open Discovery → Initial.
- Trigger: type query/apply filters → Searching → Results.
- Trigger: click Search Assistant → Searching.
- Trigger: select creator → CreatorSelected → ProfilePanelOpen.
- Trigger: toggle tab → StorefrontTab.
- Trigger: bookmark → SavedToCampaign → AddToCampaignState.
- Trigger: click Send proposal/Book → OutreachModalOpen → OutreachSent or ErrorState.

Backend implications:

- Queries hit search index; filters map to metrics; saving adds record to campaign shortlists; outreach creates Collaboration + Inbox conversation.

### Zest Flow

Based on Zest doc.[^1][^5]

States:

1. **Idle** – Zest view open, no chat.
2. **Prompting** – User selects Quick Prompt (e.g. Discover creators, Plan campaign).[^5]
3. **Chatting** – Ongoing conversation; streaming responses.
4. **CampaignCreated** – Once creators curated, campaign auto-created.[^1][^5]
5. **RefiningResults** – User adjusts constraints; Zest updates creators.
6. **OutreachDraftGenerated** – Zest drafts outreach proposals.
7. **OutreachReviewPanelOpen** – Side panel shows proposal(s) for review.[^1]
8. **OutreachSent** – Approved and sent; per-creator chat created.[^1]
9. **ReportRequested** – User asks for performance report; Zest triggers Analytics.[^7][^1]
10. **ReportGenerated** – Aggregation cards and tables summarised.

Transitions:

- Trigger: choose Quick Prompt → Prompting → Chatting.
- Trigger: refine search → RefiningResults.
- Trigger: "Generate outreach" → OutreachDraftGenerated → OutreachReviewPanelOpen → OutreachSent.
- Trigger: "Generate report" → ReportRequested → ReportGenerated.

Zest behaves like a **context-aware agent/copilot** that spans multiple steps rather than a single-step chatbot.

### Campaign Creation & Management

States (Partner side):[^20][^3]

1. **CampaignEmpty** – created with goal, ICP, budget, channels.
2. **CreatorsAdded** – via Zest or Discovery; shortlist populated.
3. **Evaluating** – statuses & notes set; creators compared.
4. **OutreachInitiated** – requests/inquiries sent.
5. **CollaborationsActive** – accepted proposals; slots booked.
6. **PaymentsPending** – invoices generated; payments requested.[^3]
7. **Completed** – campaigns marked completed; analytics summarised.

Relationship chain:

```text
Campaign
  → Creator (shortlisted)
      → Proposal (from partner to creator)
          → Collaboration (accepted proposal)
              → Content (posts with tracked links)
                  → Payment (invoice & transaction)
                      → Performance (metrics in Analytics)
```

Verified conceptually in docs; data model specifics inferred.[^20][^7][^1]

### Messaging & Collaboration Flow (Creator/Partner)

States:[^16][^21]

1. **RequestReceived** – new request appears in Requests view (creator) or Home to-dos (partner).
2. **Negotiation** – messages exchanged in Inbox; proposal drafts created.
3. **ProposalSent** – proposal event logged in chat; side panel shows details.[^16]
4. **ProposalAccepted** – collaboration created; moves to Calendar & Payments.
5. **AssetsSubmitted** – creative assets attached in chat; event displayed.[^16]
6. **ContentLive** – post published; link tracked in Analytics.[^7]
7. **PaymentRequested** – invoice event in chat; Payment to-do created.[^10]
8. **PaymentCompleted** – status updated in Payments and Analytics.

***

## Zest AI UI – Detailed Reconstruction

**Verified from docs:**[^1][^5]

- Accessible as:
  - Dedicated **Zest** view in left navigation.
  - **Popup chat** from any page (context-aware).
  - Slack integration (`@zest`).

- UI behavior:
  - Prompts user for ICP, objective, budget, platforms.
  - Uses Quick Prompts such as "Discover creators", "Plan campaign".
  - Generates curated creator lists and campaign suggestions.
  - Opens an **interactive side panel** for outreach review before sending messages.
  - Can generate campaign reports and answer analytics questions.

**Inferred dedicated Zest view layout:**

```text
ZestPage
├── AppShell
├── Main
    ├── PageHeader ("Zest" title, description)
    ├── QuickPromptRow
    │   ├── PromptChip: Discover creators
    │   ├── PromptChip: Plan a campaign
    │   ├── PromptChip: Review performance
    ├── Content
        ├── ChatColumn (~60%)
        │   ├── MessageList
        │   └── ChatInput (textarea + send button)
        └── ContextColumn (~40%)
            ├── CampaignSummaryCard (if attached)
            ├── CreatorListPreview (if discovery)
            └── ReportPreviewCard (if analytics)
```

**Popup Zest:**

- Trigger: button in header or floating chat icon.
- Position: bottom-right panel (~360–400px width).
- Context: includes current page context (campaign ID, discovery filters, analytics view) to customise answers.

Zest is best modeled as an **agent module** that calls internal APIs for campaigns, creators, analytics.

***

## Discovery UX – Deep Dive

**Verified from "Creator Profile" & "Discover and Book..." articles:**[^19][^5]

Features:

- AI-powered **Creator Search** with query string (comma-separated topics for OR matching).
- **Search Assistant** invoked from search bar for guided selection of channels and topics.
- **Filters** via "add filter" button for platform audience metrics, performance metrics, and demographics.
- **Match Score** as relevance signal; >50 relevant, >70 strong match.[^19]
- **Creator cards** showing AI Description and metrics for each channel.
- **Creator profile side view** with rich information plus Storefront tab.
- "Book a product" and "Send an Inquiry" actions.[^19]

**Creator card interactions (inferred):**

- Hover displays quick actions: Book, Save to campaign, Send Inquiry.
- Bookmark icon toggles Saved state; on click opens a small select/create campaign modal.
- Clicking anywhere on the card opens side drawer.

**Search UX state breakdown:**

- Initial – empty results, placeholder text describing search.
- Search Assistant – opens inline overlay or side panel to configure filters.
- Filtered state – chips visible above results list.
- Sorted state – table/card list sorted by match score by default.

***

## Creator Profile vs Storefront UX

**Verified from docs and live storefront:**[^13][^9][^19]

- **Creator Profile (internal)** – side view in Discovery with summary:
  - Match score.
  - Description.
  - Channels.
  - Recent content.
  - Performance.
  - Audience.
  - Products.
  - Previous sponsors.
  - Rates.

- **Storefront tab (media kit)** – when toggled, shows creator’s public storefront:
  - Product previews.
  - Sponsorship examples.
  - Personal stats and narrative blocks.

**Configurable vs platform-controlled (inferred):**

- Creator-configurable:
  - Block ordering and content (About me, Previous partnerships, audience descriptions).[^4][^13]
  - Channels and stats (manual or Live Stats).[^13]
  - Products, packages, multi-product packages including pricing, placements per slot.[^2][^13]
  - Link blocks and content blocks.

- Platform-controlled:
  - Layout grid (card styling and spacing).
  - Verified stats badges (blue check) and Live Stats fetching.[^19]
  - Storefront URL structure and footer ("Built with Passionfroot").[^9]

***

## Campaign UX – Creation & Management

**Verified from Campaigns and Getting Started docs:**[^3][^20]

- Create campaign via Campaigns tab: set description and budget.
- Add creators through Discovery, Zest, or Live Campaigns applicants.[^20][^5]
- Compare creators inside campaign shortlist with statuses and notes.[^20]
- Export campaigns to Excel on premium plans.[^20]
- Send bookings via Request or Inquiry from creator side-view; each creates a chat and collaboration in Inbox/Home.[^20]

**UI relationship diagram (inferred & partially verified):**

```text
CampaignDetailPage
├── CampaignSummary
│   ├── Name, description, goal
│   ├── Budget (planned, committed, spent)
│   └── Status indicators
├── CreatorShortlistTable
│   ├── Creator row (name, platforms, audience, status, notes)
│   ├── StatusSelect (e.g., Shortlisted, Contacted, Negotiating, Won, Lost)
│   └── NotesInput
├── Actions
│   ├── Add creators (Discovery or Zest)
│   ├── Export
│   └── Open Collaborations view
└── SidePanel (optional)
    └── Creator profile/storefront when a row is selected
```

***

## Messaging UX – Detailed Reconstruction

**Verified from Messaging & Inbox docs:**[^22][^16]

- **Inbox tab** for both partners and creators.
- Each partner/creator pair has a dedicated chat with full history.
- Chat displays messages plus **key collaboration events** (proposal sent, assets submitted, invoice paid).
- **Side panel** within inbox shows:
  - Collaboration requests.
  - Creative briefings.
  - Proposals.
  - Collab history (all requests and collabs with that partner).[^16]
- **Quick action button** in chat to quickly send a proposal.[^16]
- Attachments: upload images, videos, PDFs, ZIP etc.[^16]
- Archiving: archive moves conversation to Archived tab; new messages unarchive automatically.[^16]
- Email notification fallback if message unread over 60 seconds.[^16]

**Inferred layout:**

```text
InboxPage
├── ConversationSidebar (left, ~260px)
│   ├── Tabs: All, Archived
│   ├── List items: Partner name, badge for unread, last message preview
├── ChatMain (center, flex)
│   ├── MessageThread (scrollable)
│   └── MessageComposer (bottom)
└── CollaborationSidePanel (right, ~360px)
    ├── Tabs: Requests, Briefs, Proposals, History
    └── QuickActions: Send Proposal, View Collaboration, Request payment
```

Mobile adaptation: conversation list becomes top-level screen; chat and side panel compress into stacked views.

***

## Calendar UX – Detailed Reconstruction

**Verified from Calendar docs:**[^14][^10]

- Calendar items types:
  - **Slots** – open sponsorship slots (e.g. newsletter Fridays).[^14]
  - **Collaborations** – booked or completed collabs.[^14]
  - **External bookings** – added manually to track off-platform deals.[^14]
- Filters:
  - Channel filters – segment by specific channel.[^14]
  - Booking status filters – show live collabs, unbooked slots, external bookings, blocked slots.[^14]
- Weekly total calculation: sum of sponsorship value per week, including proportional package shares.[^10]
- Quick actions: reschedule, open collab details, add slots.[^6][^14]

**Inferred calendar layout:**

```text
CalendarPage
├── Header (month selector, view toggle: Month/Week)
├── FiltersRow
│   ├── ChannelSelect
│   ├── BookingStatusSelect
├── WeeklySummaryStrip (above grid)
│   ├── WeeklyTotalBadge per week
└── MonthGrid
    ├── DayCell
    │   ├── SlotChip (color-coded by channel/product)
    │   ├── CollaborationChip
    │   └── ExternalBookingChip
```

Mobile: switch to week or agenda list view.

***

## Analytics UX – Charts & Tables

**Verified from Analytics doc:**[^7]

- **Analytics tab** includes:
  - Aggregation cards (Reach, Engagement, Engagement Rate, Spend).
  - Performance table (collaborations & posts).
  - Display button to choose metrics.
  - Filters by creator, campaign, platform, status, date range.
  - Customizable visibility for cards and columns.
- Data collection:
  - Track link from chat; automatic fetch of public metrics.
  - Daily updates for supported platforms.
  - External collab updates for off-platform creators.

**Chart library** is not publicly stated; likely uses either custom SVG charts, Recharts, or similar – not publicly verifiable.

**Clone recommendation:** Use **Recharts or Chart.js** with neutral line/bar charts; emphasise clarity over brand-specific styling.

***

## Responsive Design

There is limited explicit mobile documentation; behavior must be inferred.

**Inferred responsive rules:**

- Desktop (≥1024px): full sidebar + header; two/three-column layouts.
- Laptop (~768–1024px): sidebar shrinks; some panels compress.
- Tablet/mobile (<768px):
  - Sidebar collapses to top nav or hamburger.
  - Discovery list becomes single-column; drawer becomes full-screen.
  - Inbox conversation list and message thread become separate screens.
  - Analytics table becomes scrollable with horizontal scroll.
  - Storefront grid collapses to single-column product cards.

Because mobile workspace screenshots are not public, these details are **not publicly verifiable** and should be treated as implementation recommendations.

***

## Motion & Interaction Design

Ripplix listing references "UI animations & interaction patterns" from the live product but does not expose their specifics. Help center mentions side panels sliding into view and popups.[^28]

**Inferred animation model:**

- Panels (side drawers): slide in from right with `transform: translateX(16px → 0)`, opacity fade, duration ~180–220ms, ease-out.
- Modals: scale + fade (`scale(0.96→1)`, opacity 0→1, duration ~200ms).
- Dropdowns: fade + slight translateY.
- Skeleton loaders: shimmer effect using CSS animations.
- Chat streaming: messages appear line-by-line; Zest responses show a typing indicator.

No evidence for Framer Motion or GSAP; likely CSS transitions with React components. Animation library is **not publicly verifiable**.

***

## Accessibility Considerations

No dedicated a11y docs exist; assumptions are based on Intercom/help center markup:

- Color contrast: brand colors such as `#FF9966` vs dark text likely meet minimum contrast for large text.[^24]
- Focus states: likely 2px outline and/or box-shadow; not documented.
- Keyboard navigation: typical tab navigation; no detailed ARIA patterns described.
- Modal focus trapping & Escape closing: standard for SaaS; not publicly verifiable.

The clone should implement best-practice accessibility:

- Semantic HTML (`<nav>`, `<header>`, `<main>`, `<section>`).
- ARIA roles for dialogs and side panels.
- Keyboard shortcuts for search, open Zest, etc.

***

## Recommended Technical Architecture (Inferred)

Implementation recommendations (not facts about Passionfroot’s internals):

```text
Next.js / React
  ↓
AppShell (layout with sidebar + header)
  ↓
Design System (tokens + components)
  ↓
Feature Modules
    ├── Auth
    ├── CreatorWorkspace
    ├── PartnerWorkspace
    ├── Discovery
    ├── Campaigns
    ├── Collaborations
    ├── Inbox
    ├── Calendar
    ├── Analytics
    ├── Payments
    └── ZestAgent
```

- **Routing structure:** Use Next.js nested routes for `/creator/*` and `/partner/*`, plus `/[storefrontSlug]` for public storefront.
- **State management:** React Query or SWR for server data (campaigns, creators, analytics), plus Zustand/Redux for UI state (selected creator, open panels).
- **Server/client boundaries:**
  - Server: fetch campaigns, creators, analytics metrics.
  - Client: orchestrate Discovery filters, Zest UI, messaging interactions.
- **Form architecture:** React Hook Form; use schema validation via Zod.
- **Modals & drawers:** central modal manager with portal root.
- **Design-token structure:** CSS variables at `:root`, theme provider for dark/light if needed.
- **Chart library:** Recharts or Chart.js.
- **Calendar library:** `react-big-calendar` or custom grid.
- **Animation library:** Built-in CSS transitions or Framer Motion for complex flows.
- **Icon library:** Lucide or Heroicons.

All of this is purely **recommended** and not claimed as Passionfroot’s actual stack.

***

## Proposed Route Map for Clone

**Creator-facing:**

```text
/creator/login
/creator/signup
/creator/home
/creator/storefront
/creator/storefront/editor
/creator/partners
/creator/calendar
/creator/requests
/creator/products
/creator/payments
/creator/discover
/creator/inbox
/creator/settings
```

**Partner-facing:**

```text
/partner/login
/partner/signup
/partner/home
/partner/zest
/partner/discovery
/partner/discovery/[creatorId]
/partner/campaigns
/partner/campaigns/[campaignId]
/partner/collaborations
/partner/live-campaigns
/partner/live-campaigns/[campaignId]
/partner/inbox
/partner/analytics
/partner/payments
/partner/settings
```

**Public Storefront:**

```text
/[storefrontSlug]
```

Route names are inferred based on docs and workspace domain; actual Passionfroot routes are not published.

***

## Page-by-Page Implementation Checklist (Selected Pages)

### Discovery (Partner)

- [ ] Layout: two-column (list + drawer).
- [ ] Navigation: accessible from sidebar; Zest deep-link.
- [ ] Search: AI-powered search input with assistant trigger.
- [ ] Filters: add filter button; chips for demographics, metrics.[^19]
- [ ] Sort: default by Match Score; allow other sorts.
- [ ] Creator cards: show AI Description, stats, Match Score.[^19]
- [ ] Pagination/infinite scroll: load more results.
- [ ] Loading state: skeleton rows.
- [ ] Empty state: helpful copy when no matches.
- [ ] Error state: banner for network errors.
- [ ] Creator side panel: overview + Storefront tab.[^19]
- [ ] Save creator: bookmark icon; campaign selector.[^5]
- [ ] Add to campaign: backend call to link.
- [ ] Outreach modal: Request vs Inquiry options.[^19]
- [ ] Responsive behavior: drawer full-screen on mobile.
- [ ] Keyboard behavior: focusable filter chips & cards.
- [ ] Animations: slide-in drawer.

### Zest

- [ ] Layout: chat + context column.
- [ ] Navigation: dedicated tab + popup.
- [ ] Prompt area: Quick Prompts row.[^1][^5]
- [ ] Conversation history: persistent per workspace.
- [ ] Loading behavior: typing indicator, streaming responses.
- [ ] Tool/action UI: buttons to "Create campaign", "Generate outreach", "Generate report".
- [ ] Creator recommendations: results list connected to Discovery.
- [ ] Campaign generation: show new campaign summary.
- [ ] Side-panel behavior: outreach review panel with edit form.[^1]
- [ ] Error handling: message bubble when agent fails.

### Campaign Detail

- [ ] Layout: summary header + creator shortlist.
- [ ] Navigation: back to Campaigns; links to Collaborations, Analytics.
- [ ] Status & notes: per-creator fields.[^20]
- [ ] Export: button to download CSV.
- [ ] Loading: skeleton rows.
- [ ] Empty: CTA to add creators.

### Inbox

- [ ] Layout: conversations list, message thread, side panel.[^16]
- [ ] Conversation list: statuses (unread, archived).
- [ ] Message bubbles: show sender, time, content, attachments.
- [ ] Attachments: upload UI for supported files.[^16]
- [ ] System messages: events like proposal sent, assets submitted, invoice paid.[^16]
- [ ] Composer: input + send, attachments.
- [ ] Quick actions: "Send proposal" button.[^16]
- [ ] Archiving: Archived tab with unarchive feature.[^16]
- [ ] Notifications: show email fallback message.

### Calendar

- [ ] Layout: filters row + month grid.[^14]
- [ ] Item types: slots, collaborations, external bookings.[^14]
- [ ] Weekly totals: compute per week; handle package split.[^10]
- [ ] Quick actions: reschedule, open collab, add slots.[^6][^14]
- [ ] Filters: channel, booking status.[^14]

### Analytics

- [ ] Layout: filters, aggregation cards, performance table.[^7]
- [ ] Supported metrics: impressions, views, engagement, CPM, spend.[^7]
- [ ] Daily updates: show updated timestamp.[^7]
- [ ] External collabs: row creation for external posts.[^7]

### Storefront (Public)

- [ ] Layout: hero + sections for newsletter, website, X, LinkedIn etc.[^9]
- [ ] Previous partnerships: brand logos list.[^9]
- [ ] Stats blocks: metrics per channel.[^13][^9]
- [ ] Products: price cards with descriptions and Book now CTAs.[^9]
- [ ] Packages: breakdown lists with included products.[^9]
- [ ] Footer: Built with Passionfroot.

Due to report length, not all pages are enumerated; a full checklist can be derived by repeating this pattern across Home, Requests, Products, Payments, Live Campaigns, Collaborations, Zest popup.

***

## Proposed Design Token File (CSS Variables)

**Note:** Values with comments are inferred approximations.

```css
:root {
  /* Colors */
  --color-primary: #FF9966; /* Verified brand color (Atomic Tangerine) */
  --color-secondary: #DEB80B; /* Inferred accent */
  --color-accent: #7C2142; /* Inferred accent */
  --color-background: #F5F3EA; /* Verified brand background */
  --color-surface: #FFFFFF;
  --color-surface-elevated: #F9F7F0; /* Inferred */
  --color-border: #E0E0E5; /* Inferred */
  --color-divider: #F0EEF5; /* Inferred */
  --color-text-primary: #1B1C1D; /* Verified brand neutral */
  --color-text-secondary: #4B4C50; /* Inferred */
  --color-text-muted: #8B8C90; /* Inferred */
  --color-success: #2E9D64; /* Inferred */
  --color-warning: #DEB80B; /* Inferred */
  --color-error: #D14343; /* Inferred */
  --color-info: #2563EB; /* Inferred */
  --color-disabled: #C2C3C8; /* Inferred */

  /* Typography */
  --font-family-sans: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-md: 16px;
  --font-size-lg: 20px;
  --font-size-xl: 24px;
  --font-size-2xl: 32px;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --line-height-tight: 1.2;
  --line-height-normal: 1.5;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 40px;
  --space-8: 48px;

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-round: 9999px;

  /* Shadows */
  --shadow-card: 0 4px 12px rgba(0, 0, 0, 0.06);
  --shadow-modal: 0 12px 32px rgba(0, 0, 0, 0.16);
  --shadow-popover: 0 8px 24px rgba(0, 0, 0, 0.12);

  /* Layout */
  --sidebar-width: 240px;
  --header-height: 64px;
  --page-max-width: 1120px;

  /* Transitions */
  --transition-fast: 150ms ease-out;
  --transition-medium: 200ms ease-out;
}
```

***

## Component Trees for Key Screens

### Home (Creator/Partner)

```text
HomePage
├── AppShell
│   ├── Sidebar
│   └── TopBar
├── PageHeader
│   └── Title "Home"
├── SummaryRow
│   ├── AtAGlanceCard
│   └── EarningsCard
└── TodoSections
    ├── CollaborationsTodoCard
    │   ├── TodoList
    │   └── ViewAllLink
    └── PaymentsTodoCard
        ├── TodoList
        └── ViewAllLink
```

### Discovery

```text
DiscoveryPage
├── AppShell
├── PageHeader
│   └── Title "Discovery"
├── SearchToolbar
│   ├── SearchBar
│   ├── ChannelSelect
│   ├── AddFilterButton
│   └── MatchScoreLegend
└── Content
    ├── CreatorList
    │   └── CreatorCard (repeated)
    └── CreatorProfileDrawer
        ├── Tabs (Overview, Storefront)
        ├── CreatorSummarySection
        ├── ChannelsSection
        ├── MetricsSection
        ├── AudienceSection
        ├── ProductsSection
        ├── PreviousSponsorsSection
        └── ActionsRow (Book, Send Inquiry, Save to campaign)
```

### Creator Profile / Storefront

```text
StorefrontPage
├── AppShell (public minimal header)
├── HeroSection
│   ├── CreatorAvatar
│   ├── Title
│   └── Subtitle
├── PreviousPartnershipsSection
│   └── BrandLogoGrid
├── StatsSections
│   ├── NewsletterStatsBlock
│   ├── WebsiteStatsBlock
│   ├── SocialStatsBlocks
├── ProductsSection
│   └── ProductCard (repeated)
├── PackagesSection
│   └── PackageCard (repeated)
└── Footer
    ├── Text "Built with Passionfroot"
    └── PrivacyLink
```

### Campaign Detail

```text
CampaignDetailPage
├── AppShell
├── PageHeader
│   ├── Title (Campaign name)
│   ├── Breadcrumbs
│   └── Actions (Export, Open Collaborations)
├── CampaignSummarySection
│   ├── BudgetCard
│   ├── StatusCard
│   └── MetricsCard
└── CreatorShortlistSection
    ├── Toolbar (filters)
    └── CreatorTable
        └── CreatorRow (with StatusSelect, NotesInput, Actions)
```

### Collaboration (Collaborations View)

```text
CollaborationsPage
├── AppShell
├── PageHeader
│   └── Title "Collaborations"
├── FiltersRow
│   ├── CampaignSelect
│   ├── StageSelect
│   └── PlatformSelect
└── CollaborationTable
    └── CollaborationRow
        ├── CreatorCell
        ├── ProductCell
        ├── PlatformCell
        ├── StageCell
        ├── BudgetCell
        └── ActionsCell (Open Inbox, Open Analytics)
```

### Messaging

```text
InboxPage
├── AppShell
├── PageHeader
│   └── Title "Inbox"
├── Layout
│   ├── ConversationSidebar
│   │   ├── Tabs (All, Archived)
│   │   └── ConversationItem (repeated)
│   ├── ChatMain
│   │   ├── MessageThread
│   │   └── MessageComposer
│   └── CollaborationSidePanel
│       ├── Tabs (Requests, Briefs, Proposals, History)
│       └── PanelContent (cards + quick actions)
```

### Calendar

```text
CalendarPage
├── AppShell
├── PageHeader
│   └── Title "Calendar"
├── FiltersRow
│   ├── ChannelSelect
│   ├── BookingStatusSelect
│   └── ViewToggle
├── WeeklySummaryStrip
│   └── WeeklyTotalBadge (repeated)
└── MonthGrid
    └── DayCell
        ├── SlotChip (0..n)
        ├── CollaborationChip (0..n)
        └── ExternalBookingChip (0..n)
```

### Analytics

```text
AnalyticsPage
├── AppShell
├── PageHeader
│   └── Title "Analytics"
├── FiltersRow
│   ├── CampaignSelect
│   ├── CreatorSelect
│   ├── PlatformSelect
│   └── DateRangePicker
├── AggregationCardsRow
│   ├── StatCard Reach
│   ├── StatCard Engagement
│   ├── StatCard EngagementRate
│   └── StatCard Spend
└── PerformanceTable
    └── PerformanceRow
        ├── CreatorCell
        ├── CampaignCell
        ├── PlatformCell
        ├── MetricsCells
        └── ActionsCell (Edit link, View details)
```

### Zest

```text
ZestPage
├── AppShell
├── PageHeader
│   ├── Title "Zest"
│   └── Description
├── QuickPromptRow
│   ├── PromptChip Discover creators
│   ├── PromptChip Plan campaign
│   └── PromptChip Review performance
└── Content
    ├── ChatColumn
    │   ├── MessageList
    │   └── ChatInput
    └── ContextColumn
        ├── CampaignSummaryCard
        ├── CreatorListPreview
        └── ReportPreviewCard
```

### Storefront (Editor)

```text
StorefrontEditorPage
├── AppShell
├── PageHeader
│   └── Title "Storefront Editor"
├── Toolbar
│   └── AddBlockButton
├── Canvas
│   └── BlockList
│       ├── ChannelBlock
│       ├── SponsorshipBlock
│       ├── LinkBlock
│       └── ContentBlock
└── InspectorSidebar
    ├── BlockSettingsForm
    ├── StatsSettings (Live vs manual)
    └── PreviewPane
```

***

## Visual Fidelity Analysis – What Makes Passionfroot Recognisable?

From branding references, storefronts, and help center language, the following characteristics are key:[^8][^24][^9]

1. **Warm, friendly color palette** – the Atomic Tangerine primary (#FF9966) plus soft off-white background and deep neutral text.
2. **High whitespace, low visual noise** – cards spaced out with comfortable padding; clear sections.
3. **Modern sans typography** – Inter-like; clean, readable across marketing and app surfaces.
4. **Card-based content presentation** – campaigns, creators, stats, and products all in cards with soft shadows and rounded corners.
5. **Human-centric copy** – microcopy like "Looking forward to helping you grow" or "Each time you login we welcome you home" emphasises friendliness.[^6][^19]
6. **AI-integrated workflows** – Zest surfaces within the UI, with Quick Prompts and embedded side panels.
7. **Media-kit storefronts** – multi-channel stats and detailed product cards with "Book now" CTAs strongly distinguish Passionfroot from generic SaaS storefronts.[^9]
8. **Match Score badges** – numeric relevance metric and AI descriptions in Discovery.[^19]
9. **Side panels for detail & actions** – consistent pattern: Discovery creator profile, Inbox collab side panel, Zest outreach review side panel.[^1][^19][^16]
10. **Integrated calendar with slots and external bookings** – editorial view emphasising content rather than just tasks.[^14]
11. **Strong focus on B2B creator metrics** – aggregated analytics across campaigns, CPM, spend.[^7]
12. **Partner Network & Live Campaigns** – Discover section emphasises curated brands and open briefs.[^15][^6]
13. **CRM-like partner view for creators** – dedicated Partners tab as relationship overview.[^6]
14. **Inbox events timeline** – messages interleaved with system events, emphasising business workflow.[^16]
15. **Proposal-centric UX** – quick actions to send proposals from many surfaces (Inbox, Requests, Discovery, Storefront).[^10][^19][^16]
16. **Zest as orchestrator** – cross-surface integration from strategy to outreach to analytics.[^5][^1]
17. **Live Stats verification & blue checkmarks** – emphasising trusted metrics.[^13][^19]
18. **Discover Connect limits** – 5 connects per week; fosters considered outreach.[^15]
19. **Built with Passionfroot footer on storefronts** – strong branding callout.[^9]
20. **Tone: professional but playful** – emojis and friendly phrasing throughout help center and UI copy.

A clone must reproduce these characteristics (colors, card treatment, side panels, AI-integration patterns, friendly copy) to feel recognisably Passionfroot-like rather than a generic CRM.

***

## Evidence / Confidence Matrix

| Finding | Evidence | Confidence |
|---------|----------|-----------|
| Creator sidebar includes Storefront, Requests, Calendar, Products, Payments | Creator FAQs & Workspace section.[^10][^6] | High |
| Partner Discovery includes Match Score, AI descriptions, Storefront tab | "Creator Profile" & Discovery docs.[^19][^5] | High |
| Zest has dedicated view + popup and outreach review side panel | Zest doc describes view, popup, side panel.[^1][^5] | High |
| Storefront uses blocks (channel, sponsorship, link, content) and Live Stats | Storefront docs.[^13][^4] | High |
| Analytics tab has aggregation cards and performance table | Analytics doc.[^7] | High |
| Inbox has side panel for collab history, quick actions, archiving | Messaging & Inbox docs.[^16][^22] | High |
| Calendar supports slots, collaborations, external bookings | Calendar menu doc.[^14][^10] | High |
| Brand primary color is Atomic Tangerine (#FF9966) | Brand colors reference.[^24] | High |
| Use of Inter-like font | Help center hints; Intercom mention; typical SaaS fonts.[^25] | Medium (inferred) |
| Sidebar width ~240px; layout geometry as described | General SaaS pattern; not explicitly documented | Medium (inferred) |
| Animation durations & easing | No explicit sources; pattern-based | Low (inferred) |
| Mobile behavior for workspaces | Not documented; assumed from best practices | Low (inferred) |
| Route structure (`/creator/*`, `/partner/*`) | Auth URLs partially visible; internal routes not public.[^11][^12] | Medium (inferred) |

Where information is **not publicly verifiable**, this report relies on reasonable inference and marks it as such.

***

## Final Question – What Information Would Still Be Missing?

If an engineer had to rebuild Passionfroot’s current UI from scratch without access to the original source code, the following gaps would remain after this reconstruction:

1. **Exact typography** – precise font family, sizes, weights, and letter-spacing tokens used in the workspace (we infer Inter-like, but this is not confirmed).
2. **Precise color values and theming** – verified primary/neutral colors exist, but full palette (hover states, borders, chart colors, dark mode if any) is not publicly documented.
3. **Component-level spacing and radii** – actual pixel values for paddings, margins, border-radii on each component type remain unknown.
4. **Detailed layout breakpoints** – exact responsive breakpoints and layout rearrangements for tablet and mobile sizes are not documented.
5. **Animation implementation** – concrete transitions, easing curves, and whether Framer Motion or pure CSS is used are not exposed.
6. **Full route map & URL structure** – internal routes for campaigns, collaborations, discovery, and Zest are hidden behind auth and not explicitly documented.
7. **Complete state machines** – while major flows are described, smaller edge-case states (e.g., partial payments, failed Stripe onboarding, permission-denied screens) are not fully specified.
8. **Role-based permissions details** – exact differences between plan tiers (Growth vs Scale) in UI (feature gating, toggles, badges) and per-user roles inside a

---

## References

1. [ZEST - The Creator marketing AI Agent](https://help.passionfroot.me/en/articles/13610469-zest-the-creator-marketing-ai-agent)

2. [Day 1 with Passionfroot](https://help.passionfroot.me/en/articles/11552627-day-1-with-passionfroot)

3. [Getting started | Passionfroot Help Center](https://help.passionfroot.me/en/articles/11563316-getting-started)

4. [Storefront](https://help.passionfroot.me/creators/the-basics/building-your-storefront) - Your storefront is an intelligent media-kit that enables you to showcase yourself to potential spons...

5. [Discover and Book the right Creators to Your Campaign](https://help.passionfroot.me/en/articles/11563360-discover-and-book-the-right-creators-to-your-campaign)

6. [Navigating your Workspace](https://help.passionfroot.me/en/articles/11552675-navigating-your-workspace)

7. [Analytics & Insights for Partners - Passionfroot Help Center](https://help.passionfroot.me/en/articles/11631732-analytics-insights-for-partners) - Analytics gives you one place to review performance across creators, posts, and collaborations. It's...

8. [Passionfroot - The AI Agent for Creator-led GTM](https://www.passionfroot.me/) - Drive growth through trusted, human voices at scale. Find them, pay them, see the impact — no spread...

9. [Open Pedia AI | Passionfroot](https://www.passionfroot.me/openpedia) - Sharing content on AI, Tech and ways to make money online. Daily. Stats. Followers.

10. [FAQs](https://help.passionfroot.me/en/articles/11552873-faqs)

11. [Passionfroot](https://workspace.passionfroot.me/auth/login?redirectUrl=/)

12. [First, let's set up your account](https://workspace.passionfroot.me/signup)

13. [Storefront - Passionfroot Help Center](https://help.passionfroot.me/en/articles/11552776-storefront) - Your storefront is an intelligent media-kit that enables you to showcase yourself to potential spons...

14. [Calendar](https://help.passionfroot.me/menu/calendar) - The calendar gives you and your team an automated center of truth for all your brand collaborations....

15. [Discover | Passionfroot Help Center](https://help.passionfroot.me/en/articles/11552930-discover)

16. [Messaging & Inbox | Passionfroot Help Center](https://help.passionfroot.me/en/articles/11552815-messaging-inbox) - Within the inbox messaging feature, a side panel view is accessible, enabling you to conveniently ac...

17. [Discover Creators](https://help.passionfroot.me/partners/how-it-works/discover) - Discovery enables you to discover, evaluate, book, and collaborate with creators to promote your pro...

18. [Partner Settings](https://help.passionfroot.me/en/articles/11564193-partner-settings)

19. [Creator Profile](https://help.passionfroot.me/en/articles/11563360-discover-creators)

20. [Campaigns](https://help.passionfroot.me/en/articles/11563981-campaigns)

21. [Collaboration Management - Passionfroot Help Center](https://help.passionfroot.me/en/articles/11564057-collaboration-management) - Your campaigns live in the Collaborations view — this is the main hub where you create, organize, an...

22. [Inbox & Messaging](https://help.passionfroot.me/partners/how-it-works/messaging) - Our Inbox feature lets you stay in touch with creators, review proposals, submit assets, and make pa...

23. [FAQs](https://help.passionfroot.me/creators/the-basics/faqs)

24. [Passionfroot Brand Colors & Logo: HEX, RGB, HSL & CMYK ...](https://brandcolorshub.com/brand/passionfroot) - Passionfroot uses 3 colors in its palette: Atomic Tangerine (#FF9966), Shark (#1B1C1D), Spring Wood ...

25. [How it works - Passionfroot Help Center](https://help.passionfroot.me/en/collections/13366062-how-it-works) - g

26. [53+ Websites Using Satoshi - Real Design Examples](https://www.unsection.com/fonts-in-use/satoshi) - See Satoshi font in real website designs. Browse 53+ examples from showing this Geometric Sans-Serif...

27. [Passion Fruit Color Scheme - Palettes - SchemeColor.com](https://www.schemecolor.com/passion-fruit.php) - Download Passion Fruit color scheme consisting of Dried Burgundy, Authentic Pink, Sofia, Full White,...

28. [15 Passionfroot UI Animations & Interaction Patterns (2026) - Ripplix](https://www.ripplix.com/browse/apps/passionfroot-ui-animations) - Passionfroot UI Animation. Explore 15 real Passionfroot UI animation examples — teams, illustration ...

