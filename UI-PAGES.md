# Clipline — Full Page Inventory

## 1. Landing Page (`/`)
**Purpose:** Public marketing page — first thing anyone sees.
**Layout:** Full-width, no nav bar. Header with logo + "Discover / Log in / Get started". Four sections stacked vertically.
**Key elements:**
- **Hero** — Two-column: left has trust badges ("Anti-ghosting timers", "Mutual reviews"), giant headline "Book video creators. Skip the DM chaos.", subtitle, two CTAs (pill primary "Get started free →", pill outline "See a live storefront"). Right has a dark card showing a live deal pipeline (4 steps with checkmarks, auto-approve timer, $150 price, "1 revision included" badge). Ambient gradient orb floats behind the deal card.
- **Two-audience section** — Light gray bg. Two white shadow cards side by side: "For creators" and "For brands", each with paragraph + 3 bullet points with check icons.
- **How a deal runs** — Centered heading + subtitle. 4 white cards in a row, each with a numbered black pill (1-4), title (Book/Create/Approve/Review), description. Cards lift on hover.
- **Closing CTA** — Full-width dark band, centered white headline + subtitle + white pill button "Create your account →".
- **Footer** — Logo left, three links right (Find creators, Become a creator, Log in). Border-top separator.

**Colors:** Warm near-white bg (#FAF9F6), near-black ink (#1B1917), dark deal panel, amber for trust badges. No gradients in chrome.

---

## 2. Login (`/login`)
**Purpose:** Returning user authentication.
**Layout:** Full-viewport split. Left 40% is a solid dark (#1B1917) brand panel. Right 60% has the form centered.
**Key elements:**
- **Left panel** — Logo top-left, large tagline centered-low ("The marketplace where creators look like businesses."), small subtitle, copyright at bottom. All white-on-dark.
- **Right side** — White card with soft shadow. "Welcome back" heading, "Log in to your account" subtitle, email + password fields, black pill "Log in" button. Below card: "Don't have an account? Sign up" link.
- **Mobile** — Left panel hidden, logo centered above the card.

---

## 3. Signup (`/signup`)
**Purpose:** New user registration (creator or brand).
**Layout:** Same split layout as login.
**Key elements:**
- **Left panel** — Different tagline: "Set your formats, set your prices. Get booked with a brief." Subtitle: "Free for creators — you keep 100% of your rate."
- **Right side** — White shadow card. "Create your account" heading, "Start booking or get booked in minutes" subtitle. Fields: role dropdown (pill-shaped, "Video creator" / "Brand"), display name, email, password ("Min 8 characters" placeholder). Black pill "Create account" button. Optional green invite banner if `?invite=` param present.

---

## 4. Creator Dashboard (`/dashboard`)
**Purpose:** Creator's home — business overview and quick actions.
**Layout:** Sticky pill-tab nav at top. Max-width 6xl. Two-column below stats on large screens.
**Key elements:**
- **Header** — "Your studio" title, subtitle changes based on storefront status, "View storefront" button if live.
- **3 stat cards** — Row of white shadow cards with shimmer-on-hover: "Earned on Clipline" ($X, N deals), "Active deals" (count + awaiting), "Brand rating" (star X.X or dash). Staggered entrance animation.
- **Left column: Recent deals** — White shadow card. Header "Recent deals" with "All deals →" link. List of deal rows (secondary bg, hover to white card): offering title + status badge (amber for action-needed) + price. Empty state: envelope icon + "No bookings yet" message.
- **Right column: Storefront card** — Creator's gradient banner at top, handle + status badge, links to edit profile/socials/offerings/portfolio. Below: "Finish setup" checklist with empty circles + dashed-border links for incomplete steps (X/5 progress).

---

## 5. Creator Profile Edit (`/dashboard/profile`)
**Purpose:** Edit creator handle, bio, niches, country, languages.
**Layout:** Narrow (max-w 2xl), form page.
**Key elements:** Title "Your creator profile", status badge, form fields (handle, bio textarea, niches CSV, country, languages CSV), "Save profile" button. Publish/Unpublish toggle button at bottom.

---

## 6. Creator Offerings (`/dashboard/offerings`)
**Purpose:** Manage bookable offerings (pricing, formats).
**Layout:** Narrow (max-w 2xl).
**Key elements:** Title "Your offerings". List of existing offerings as bordered cards: title + price, type/turnaround/revisions metadata, Hide/Activate + Delete buttons. Below: "Add an offering" form — type dropdown, title, description, price, turnaround days, revision limit. Success/error banners.

---

## 7. Creator Portfolio (`/dashboard/portfolio`)
**Purpose:** Manage video portfolio links shown on storefront.
**Layout:** Max-w 4xl, two-column grid for items.
**Key elements:** Title "Your portfolio" + subtitle. White shadow card "Add a video" form (URL + caption + button). Grid of portfolio cards: gradient header strip, platform badge (YouTube/TikTok/Instagram) floating up from gradient, caption, host URL, Open link + Remove button. Empty state: dashed border, "No videos yet" + guidance.

---

## 8. Discover (`/discover`)
**Purpose:** Browse/search creators (brand-facing primarily, but creators can access too).
**Layout:** Max-w 6xl. Search band at top, 3-column card grid below.
**Key elements:**
- **Tab toggle** (brands only) — Pill-shaped "New creators" / "Worked with" switcher.
- **Search band** — Rounded container with search input + "Search" button, row of filter chips: niche, country, format dropdown, min/max price. Preference-default notice for brands.
- **Saved searches** (brands) — Row of pill chips with x delete buttons + "Save this search as..." input.
- **Creator cards** — 3-column grid with staggered entrance. Each card: gradient banner (taller, 96px), large avatar initial (56px, ring, scales on hover), name + handle + country, bio (2-line clamp), niche badges, "From $X - N offerings" with arrow indicator pill that turns dark on hover. Checkbox overlay for brand reachout selection. Cards lift on hover.
- **Reachout bar** (brands, new tab) — Banner with "Tick creators and invite them" + "Invite selected" button.
- **Pagination** — Centered prev/next with page counter.
- **Empty state** — Dashed border, message, "Clear all filters" button.

---

## 9. Public Storefront (`/c/[handle]`)
**Purpose:** Public creator profile page (their "shop window"). ISR-cached.
**Layout:** Max-w 4xl, no app nav (just logo + "Find more creators" link).
**Key elements:**
- **Gradient identity banner** — Full-width rounded-3xl, creator's deterministic gradient. Contains: avatar initial (large white rounded square), display name (huge weight-900), handle + country, bio, niche pills (white/20 bg). Floating proof badge top-right (reviews count, star rating, "Verified").
- **Audience section** — 3-column stat cards with shimmer hover: platform name + Verified badge, handle, big follower count, "followers" label, avg views, engagement %, last sync date. Empty state: dashed border.
- **Section divider** — Subtle warm gradient hairline.
- **Offerings section** — Stacked white shadow cards: title + type badge pill + turnaround/revisions metadata, large price right-aligned, description, "Book this" pill button. Cards lift on hover.
- **Brand reviews** — 2-column grid of secondary-bg cards: star rating (amber stars, gray stars for empty), review body, date.
- **Recent work** — 2-column portfolio cards: gradient strip, floating platform badge, caption, URL. Links to external video.

---

## 10. Book an Offering (`/book/[offeringId]`)
**Purpose:** Brand books a specific offering — sends a brief.
**Layout:** Narrow (max-w 2xl), form page with nav.
**Key elements:** Title "Book: [offering title]". Summary card: creator handle, price, turnaround, revisions. Amber payment notice ("Payment handled outside platform"). Form: goals textarea (required), product description textarea, talking points textarea. "Send booking request" button.

---

## 11. Deals List (`/deals`)
**Purpose:** All deals for the current user (brand or creator).
**Layout:** Max-w 4xl, three sections.
**Key elements:** Title "Your deals" + summary subtitle ("N total - N need your action"). Three sections:
- **Action needed** — Amber dot indicator, count badge. Deal rows as white shadow cards with hover lift: offering title + role (buying/selling), status badge, price.
- **In progress** — Same card style, no amber dot.
- **Done** — Same card style.
- Empty sections: dashed border "Nothing here."

---

## 12. Deal Detail (`/deals/[id]`)
**Purpose:** Single deal view — full lifecycle management.
**Layout:** Narrow (max-w 2xl), stacked sections.
**Key elements:**
- **Header** — "← All deals" back link, offering title, "You booked/Booked by [name] - $X.XX".
- **Status banner** — Rounded pill, amber bg + dot for attention states, secondary bg for normal.
- **Payment notice** (off-platform deals) — Amber banner with paid date.
- **Deliverables card** — White shadow card: preview URL, live post URL, revision counter.
- **Brief card** — White shadow card with structured sections: GOALS, PRODUCT, TALKING POINTS (uppercase labels, content below).
- **Messages** — Inline message thread component.
- **Next steps card** — Amber dot header, action forms (URL input + submit button for each available action, destructive outline for cancellation).
- **Mark as paid** button (brand, off-platform).
- **Review card** — Rating dropdown (pill-shaped), textarea, submit button.
- **Timeline** — Secondary bg, visual vertical dot-and-line timeline: each event as dot + action text + timestamp. "Report a problem" link.

---

## 13. Campaigns List (`/campaigns`)
**Purpose:** Brand creates campaigns; creators browse and apply.
**Layout:** Max-w 4xl.

**Brand view:**
- List of campaigns as bordered cards: title + type/deadline + pending count badge + status badge + budget range.
- "Start a campaign" form below: title, description textarea, content type dropdown, budget min/max, application deadline date picker.

**Creator view:**
- List of open campaigns as bordered cards: title + budget, brand name + type + deadline + application status badge, 2-line description preview.
- Empty state: dashed "No open campaigns right now."

---

## 14. Campaign Detail (`/campaigns/[id]`)
**Purpose:** Campaign detail — brand reviews applications, creators apply.
**Layout:** Max-w 4xl.
**Key elements:** "← Campaigns" back link, title + budget, metadata (brand name, type, deadline, open/closed badge), full description.

**Brand panel:** "Applications" header + Close/Reopen campaign button. List of application cards: creator name + handle link, status badge, proposed price, pitch text. Accept/Decline buttons for pending ones. Deal link for accepted ones.

**Creator panel:** If applied: "Your application" card with status + price + pitch + withdraw button. If open and not applied: "Apply" form with pitch textarea + price input.

---

## 15. Inbox (`/inbox`)
**Purpose:** Conversations between brands and creators.
**Layout:** Max-w 4xl.
**Key elements:**
- **Brand invitations** (creator, pending) — Amber-dot header with count. Cards with amber ring: brand name, invite message, Accept/Decline buttons.
- **Conversations** — List of white shadow cards with hover lift: counterpart name + status badge (Invite pending / Active / Declined).
- **Empty state** — Icon + "No conversations yet" + guidance text.

---

## 16. Conversation Detail (`/inbox/[id]`)
**Purpose:** Single conversation thread — messages, offers, deal creation.
**Layout:** Max-w 3xl.
**Key elements:**
- Header: "← Inbox", counterpart name, handle link, status badge.
- **Invitation block** — Secondary bg rounded card: "INVITATION" uppercase label, invite message text. Accept/Decline buttons if pending.
- **Offers section** — List of bordered cards: offering title, status badge, price, note text. Accept ("Accept — start the deal") / Decline buttons for pending offers. Deal link for accepted.
- **Messages section** — Bordered card: chat bubbles (dark pill for self, secondary for other), timestamps. Textarea + Send button. "Draft a reply with AI" button for brands.
- **Send an offer** (brand) — Bordered card: offering dropdown, price input, scope note textarea, "Send offer" button.
- **Block creator** button at bottom (brand only, destructive outline).

---

## 17. Brand Home (`/brand`)
**Purpose:** Brand's dashboard overview.
**Layout:** Max-w 6xl.
**Key elements:**
- Header: company name + "Brand settings" + "Find creators" buttons.
- **4 stat cards** — Row with staggered animation: Contacted, In progress, Completed, Blocked. Shimmer hover.
- **Contacted creators** — Card list rows: creator name, invite status badge. Link to inbox.
- **Arrangements in progress** — Card rows: creator name + offering title, status badge + price. Link to deal.
- **Completed** — Same card style.
- **Blocked creators** — Bordered rows: name + Unblock button.

---

## 18. Brand Settings (`/brand/settings`)
**Purpose:** Brand profile, products, outreach template, invites.
**Layout:** Narrow (max-w 2xl).
**Key elements:**
- "← Brand home" back link. Title "Brand settings".
- **Website ingest** — Bordered card: "Read from your website" + URL input + scrape button.
- **Brand profile form** — Company, website, description, notes, outreach template, niche preferences, content type preferences (checkboxes), guidelines/rules file paths.
- **Products section** — List of bordered cards (name + link + description + Remove button). Add product form.
- **Invites section** — "Invite influencers who aren't on Clipline". Contact input + "Create invite" button. List of invite cards: contact + status badge (Joined/Waiting), copy-invite-message button.

---

## 19. Brand Onboarding (`/brand/onboarding`)
**Purpose:** First-time brand setup (redirects to /brand after completion).
**Layout:** Narrow (max-w 2xl), no nav.
**Key elements:** Title "Tell us about your brand" + "Do this later → Discover" skip link. Subtitle. Website ingest card. Brand profile form (same fields as settings, pre-filled from website scrape if available).

---

## 20. Notifications (`/notifications`)
**Purpose:** Notification feed (marks all read on view).
**Layout:** Max-w 3xl.
**Key elements:** Title "Notifications". List of card rows: unread get amber ring + amber dot indicator, title (bold if unread), body, date. Clickable rows link to relevant page. Empty state: bell icon + "All caught up" message.

---

## 21. Creator Onboarding (`/onboarding/*`)
**Purpose:** Multi-step wizard for new creators.
**Layout:** Shared wizard shell with progress steps.
**Steps:** `/onboarding` (start), `/onboarding/profile`, `/onboarding/socials`, `/onboarding/offerings`, `/onboarding/highlights`, `/onboarding/publish`.

---

## 22. Admin (`/admin`, `/admin/deals/[id]`)
**Purpose:** Admin dashboard for reviewing deals.
**Layout:** Basic nav with Admin + Deals links.

---

## 23. Report (`/report`)
**Purpose:** Report a problem with a deal.

---

## Design System Constants

Tokens are **not** duplicated here — see `DESIGN.md`, which is the source of
truth, and `app/globals.css` for the implemented values.

**This inventory describes the app as built under the superseded "Gallery Frame"
system (top pill-tab nav, `max-w-6xl` centered columns, shadow-cards, weight-900
headings, pill controls).** `DESIGN.md` was rewritten on 2026-09-04 to the
"Workspace" direction, which changes the shell and density rules for every
authenticated page listed above. Read the page descriptions as *current
behaviour to be migrated*, not as the target. In particular these will change:

- The sticky top nav becomes a persistent left rail (affects every app page).
- `max-w-6xl` / `max-w-4xl` / `max-w-2xl` app containers become a full-bleed
  inset panel, with `560px` reserved for forms only.
- Inbox, deals, campaigns, applications and notifications move from
  shadow-card lists to dense tables with the next action on the row.
- Dashboard sub-tabs (`?tab=profile|offerings|portfolio`) are promoted to
  top-level Storefront destinations.
- Hero stat cards become a compact, filter-aware summary strip.
