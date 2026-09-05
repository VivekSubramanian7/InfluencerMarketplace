# Passionfroot vs. Clipline — UI/UX Gap Analysis

**Date:** 2026-09-04 · **Status:** current · **Supersedes:** nothing

Source of the "Workspace" direction in `DESIGN.md`. Written so nobody has to
re-open and re-read the screenshots — the index in §1 describes what each one
shows, and every finding below cites the shots it came from.

**Evidence:** 13 screenshots of the live Passionfroot product in
`slack-screenshots/c-research/` — 8 from the creator workspace
(`creator/creator-01..08.png`), 5 from the brand/partner workspace
(`brand/brand-01..05.png`). Account shown: creator "Whatever Matters"
(passionfroot.me/whatevermatters, ~116K subscribers), partner "Scriptbee".

**Method:**
- Clipline's side was read from source — `app/**/page.tsx`, `components/site-nav.tsx`, `app/globals.css`, and the page inventory in `UI-PAGES.md` — not from screenshots.
- Passionfroot color values were **sampled from screenshot pixels** with `sips` (1×1 crop → BMP → byte read), not estimated by eye. Screenshots are ~2.87× retina (2936×1574), so display coordinates were scaled before sampling. Values on antialiased edges are approximate; flat-fill samples are exact.
- Contrast ratios were computed, not asserted. See `DESIGN.md` §Accessibility.

> **Not derived from `RevEng_PassionFroot.md`.** That document is a separate,
> largely self-declared "inferred" reconstruction, and several of its values
> (Inter, `#FF9966` primary, shadowed cards) contradict what these screenshots
> actually show. It remains useful for feature and flow research.

---

## 1. Screenshot index

Read this instead of re-opening the files.

### Creator workspace

| File | Screen | What it shows |
|---|---|---|
| `creator-01.png` | Home | Identity dropdown open (name, email, Log out). "At a glance" = 2 mini-cards (Unread conversations `0` → "Open inbox →"; Total earnings `$935`, "$0 this month" → "View all →"). "To-dos" with "View all collaborations" link; one row: avatar, "Magical", meta line `Featured Placement · Whatever Matters · May 22, 2024 · $1,200`, right-aligned **"Request payment →"** + "2y ago". Intercom bubble bottom-right. |
| `creator-02.png` | Inbox | **A real table.** Column headers "Partner" / "Last activity". 10 rows visible: avatar initial, partner name, platform badge, actual last-message text ("You: Are you interested or not?"), relative time below. Active/Archived pill tabs. Row hover reveals an archive icon. Two greyed rows with tooltip "This partner is no longer active." |
| `creator-03.png` | Storefront | Two columns. Left: "Your storefront stats" card (Total views `2`, Unique visitors `1`, "Past 7 days", "How to grow your stats"); "Share Storefront" card with link `passionfroot.me/whatevermatters`, **Copy link** + **Share to…** buttons. Right: **live preview panel** with the rendered public storefront (avatar, name, bio, social icons, channel card with Subscribers `116K` / Open rate `35%`). Header: "● Published" + dark **"Edit storefront"** button (rounded rect, ~8px — not a pill). |
| `creator-04.png` | Calendar | Month grid (September 2026), "Add slots" + "Today" + prev/next. **Right panel**: "Calendars" list with per-layer eye toggles (Collaborations, Available slots, Blocked slots, External bookings), then colored dots per collaboration with the partner name beside each, then "This month" → "Scheduled / No collaborations this month". Hover on a day cell shows a `+`. |
| `creator-05.png` | Collaborations | **Filter-token bar**: `Sorted by Collaboration stage`, `Collaboration stage: Any of 10 stages ×`, `Publish period: From Jun 4, 2026 ×`, `+`. Empty state inside the panel: "No collaborations yet / Your active collaborations with partners will appear here." |
| `creator-06.png` | Discover (Available) | Left intro column with illustration + serif/display heading "Discover opportunities" + paragraph. Right: Available/Sent pill tabs, "Live Campaigns" section with a promo card ("Introducing Live Campaigns", illustration, "Learn more"), then mascot empty state "More opportunities coming soon / You've already joined all opportunities available to you." |
| `creator-07.png` | Discover (Sent) | **Row per application**: avatar + brand name, campaign title, "Sent" status chip, right-aligned **"View application →"** button. 6 rows visible (Luma AI, Uare ×2, Skygen.ai, Luma AI, Honen). |
| `creator-08.png` | Settings | **Leaves the app shell.** Back chevron + "Settings" title, own left rail ("Whatever Matters" → Account details / Login & Security / Payments). Content: "Personal details", profile picture row with helper text, **disabled** email field with explanation "You can't change your email address yet. Reach out to us for support.", Display name, Content language select, dark "Update details" button. Below a hairline: "Workspace access" + red **"Delete account"** text link. |

### Brand / partner workspace

| File | Screen | What it shows |
|---|---|---|
| `brand-01.png` | Home | **Home is an AI composer.** Rail: "Scriptbee" + green "Partner" badge, "FrootWallet Balance $0" chip, nav (Home, Inbox, Zest `Beta`, Campaigns, Analytics, Discover, Live Campaigns, Settings, Help Center). Main: "Hey Narayanan, / Let's plan your next creator campaign `Beta`", large prompt input ("Plan campaigns, find creators, or type @ to link a campaign…"), "Upgrade to unlock full access" + Upgrade button. Below: mini-cards (Unread `0` Creator messages; "Start with FrootWallet") + "Tasks" panel. **Floating bottom-left: "Let's get you set up"** — progress bar, 5 steps, "Set up your profile" struck through, "Create a campaign" expanded with inline **Create campaign** + "Learn more", minimize (—) control. |
| `brand-02.png` | Inbox | Three-pane shell: rail → list column (Find Creator search, filter icon, Active/Archived tabs) → detail pane. Empty state: mascot illustration, "No conversations yet", "Use Zest to discover creators and start conversations—they'll all appear here in your inbox.", then **three suggested prompts with A/B/C keyboard hints** ("Start a campaign to grow brand awareness →" / "Build a campaign for my product launch →" / "Ask Zest something else"). |
| `brand-03.png` | Campaigns | Three panes. Middle: "Campaigns" + empty-state illustration "Your campaigns live here" + **Create campaign**; "All collaborations" / "Unassigned" pinned at the bottom. Right: "All collaborations" with `View settings` + `Sorted by Collab stage` + filter tokens; **top-right metric row** Budget / Spend / Confirmed / Paid / To allocate (all `—`); **compact summary strip** Tasks `0` / In negotiation `0` `$0` / Collab. confirmed `0` `$0` / Live posts `0` / Submitted reports `0`; then the mascot empty state. |
| `brand-04.png` | Analytics | Rail **collapsed** (`«` control visible). "All posts" + `Export` + `Get reporting insights`. Filter tokens. Summary strip: Creators / Live posts / Impressions 🔒 / Engagement 🔒 (sub-rows Reactions, Comments, Other) / Eng. rate 🔒 / Avg. CPM 🔒 / Spend 🔒 — **lock icons mark gated metrics**. Empty state: "No results match your filters" + **Reset filters** button (distinct from the first-run state). |
| `brand-05.png` | Settings | Same pattern as `creator-08` but **grouped by scope**: personal (`rayn@scriptbee.ai` → Personal details / Notifications / Login & Security) above a divider, then company (`Scriptbee` → Company details / Members / Plans & Billing / Payments). Fields: disabled email w/ explanation, "Your full name", "Your role" + helper "Enter your job title for a more personal touch", dark "Update details". |

---

## 2. Headline finding

**The palette is not the problem.** Sampled side by side, the two products
already share a warm off-white ground (`#F8F7F3` vs `#FAF9F6`), a pure white
card surface, and a near-black primary action. They are within a couple of
percent.

The distance is **structural**, and it reduces to four decisions:

1. Passionfroot commits to a **persistent left rail**; Clipline uses a top tab capsule.
2. Passionfroot **fills the viewport**; Clipline centers a `max-w-6xl` column.
3. Passionfroot renders work queues as **dense tables with the next action on the row**; Clipline renders them as shadow-cards you must click into.
4. Passionfroot gets depth from **hairlines and a background step**; Clipline puts a shadow on everything.

Fix the shell and the row density and the product reads like Passionfroot
before a single hex value changes.

## 3. Where the difference lives

Ordered by contribution to the difference in feel. Everything marked **Far** is
a structural decision, not a styling one.

| Dimension | Passionfroot | Clipline | Distance |
|---|---|---|---|
| Navigation model | Persistent left rail, 9 destinations, grouped | Top pill capsule, 4–5 text links | **Far** |
| Page shell | Full-bleed inset panel, up to 3 panes | Centered `max-w-6xl` column | **Far** |
| Work queues | Tables with preview, time, hover actions | Shadow-cards with name + badge | **Far** |
| Acting on work | Primary action on the row | Only on the detail page | **Far** |
| Filtering | Removable filter tokens on every list | Only on Discover | **Far** |
| Elevation | Hairlines + background step, flat | `shadow-card` on everything | Medium |
| Type scale | 24px/600 titles, 14px body | `text-3xl font-black` titles | Medium |
| Radii | 8px controls, 12px cards | Pill controls, 18–24px cards | Medium |
| Palette | Warm off-white, soft near-black | Warm off-white, harder near-black | Close |

---

## 4. Gap detail

19 findings. Severity is about impact on the product's core job, not effort.

### Shell

#### S1 · Persistent left rail vs. top pill-tab bar — **Critical**
- **Passionfroot:** A fixed left rail carries everything: identity block (avatar, workspace name, role badge, chevron → email + Log out), a primary `+ New…` button directly beneath it, then three hairline-separated groups — core (Home, Inbox, Storefront), business (Calendar, Payments, Collaborations, Discover), utility pinned lower (Settings, Help center). Every item has an icon and a label. Active item is a white pill on the beige rail. "New" badges and unread dots sit inline on the specific item (red dot on Payments). Brand side adds a collapse control.
- **Clipline today:** `components/site-nav.tsx` renders a sticky top bar constrained to `max-w-6xl`: wordmark, a capsule holding 4–5 text-only links, and bell + logout icon buttons on the right. No icons, no grouping, no identity, no role.
- **Why it matters:** A horizontal capsule caps out around five items, so features get nested instead of surfaced — the whole storefront business (profile, offerings, portfolio) is buried behind `?tab=` query params on `/dashboard`. Passionfroot's rail carries nine destinations without strain and gives every one a permanent, memorable position.
- **Change to make:** Introduce an `AppShell` with a fixed ~220px rail and promote Storefront, Payments/Wallet, Collaborations and Discover to top-level destinations. Move per-item unread counts out of the single bell and onto the owning nav item.
- **Evidence:** all 13

#### S2 · Full-bleed inset work surface vs. centered document column — **Critical**
- **Passionfroot:** The rail sits flush against the viewport edge and the content region is a rounded panel inset into the warm app background — the background is visible at the outer edge. Content uses the entire remaining width. The brand side escalates to three panes: rail, list column, detail panel.
- **Clipline today:** Every page is `mx-auto max-w-6xl px-6 py-10` on a flat background — dashboard, deals, inbox, discover alike.
- **Why it matters:** On any display wider than ~1300px Clipline leaves dead gutters on both sides and reads as a document rather than an application. It also forecloses the master–detail layouts Passionfroot leans on for triage.
- **Change to make:** Shell becomes `flex h-dvh`: fixed rail plus `main flex-1 overflow-y-auto` holding a rounded inset surface. Reserve the centered narrow column for forms only, inside the panel.
- **Evidence:** `brand-01`–`brand-04`, `creator-03`

#### S3 · No always-available create action — **High**
- **Passionfroot:** `+ New…` sits immediately under the identity block on the creator rail, above all navigation — the most prominent control in the chrome, reachable from any page.
- **Clipline today:** Creation is buried inside whichever page owns it: the add-offering form is at the bottom of a dashboard tab, "Start a campaign" is a form below the campaigns list, booking starts from a creator's public storefront.
- **Why it matters:** The user must navigate to the right page before they can create anything, which means knowing the information architecture before acting.
- **Change to make:** Primary action button in the rail with a menu covering the real create verbs (new offering, new campaign, invite a creator, block calendar dates).
- **Evidence:** `creator-01`–`creator-07`

#### S4 · Workspace identity and role absent from chrome — **Medium**
- **Passionfroot:** Top of the rail always shows avatar, workspace name, and a colored role badge — peach "Creator", mint "Partner". Clicking reveals the signed-in email and Log out. The brand rail adds a FrootWallet balance chip.
- **Clipline today:** Role is only implied by which nav links render. No avatar, no display name, no role badge anywhere. Logout is an unlabeled icon.
- **Why it matters:** In a two-sided marketplace where one person can hold both roles, nothing on screen confirms which side of the product they're looking at.
- **Change to make:** Identity block at the top of the rail with avatar, name, role chip, and a menu holding email, settings, logout.
- **Evidence:** `creator-01`, `brand-01`, `brand-05`

### Density

#### D1 · Dense rows for work queues vs. shadow-cards for everything — **Critical**
- **Passionfroot:** The inbox is a genuine table: column headers ("Partner", "Last activity"), one row per conversation carrying avatar, partner name, platform badge, the actual last message text, and a relative timestamp. Row hover reveals an archive action. Inactive partners are dimmed with an explanatory tooltip. ~10 rows fit the viewport.
- **Clipline today:** The inbox is a stack of white shadow-cards showing only counterpart name plus a status badge — no avatar, no message preview, no timestamp. ~6 fit the same space.
- **Why it matters:** You cannot triage without opening each conversation, and you see half as many at once. This is the pattern that makes Clipline feel like a marketing site wearing an app's clothes.
- **Change to make:** Adopt the underlying rule — **rows and tables for things you act on** (inbox, deals, collaborations, applications, payments); **cards only for things you browse** (discover). Add preview text, relative time, avatar, and hover actions to every queue row.
- **Evidence:** `creator-02`, `creator-07`, `brand-03`

#### D2 · Primary action on the row, not two clicks away — **Critical**
- **Passionfroot:** Home is a to-do queue where each row carries its own action: avatar, title, a meta line (`Featured Placement · Whatever Matters · May 22, 2024 · $1,200`), and a right-aligned "Request payment →" with the relative age. The Sent applications list does the same with "View application →" on every row.
- **Clipline today:** List rows are navigation-only. The entire deal state machine is actionable exclusively from `/deals/[id]`, inside a "Next steps" card at the bottom of the page.
- **Why it matters:** Every action costs a page load plus a scroll, and the list gives no hint what the next action even is. **Clipline's anti-ghosting timers are its differentiator, yet acting on them is the slowest path in the product.**
- **Change to make:** Resolve the next action per deal server-side and render it as a button on the row. Keep the detail page for context, not as the only place to act.
- **Evidence:** `creator-01`, `creator-07`

#### D3 · Compact filter-aware summary strip vs. hero KPI cards — **High**
- **Passionfroot:** Summary metrics are small bordered tiles inside the work surface, directly above the list, describing the **currently filtered set**: Tasks, In negotiation, Collab. confirmed, Live posts, Submitted reports — each with a count and a dollar figure. A second row right-aligns Budget / Spend / Confirmed / Paid / To allocate. Analytics extends this to Impressions, Engagement (split Reactions / Comments / Other), Eng. rate, Avg. CPM, Spend, with lock icons marking gated metrics.
- **Clipline today:** Three or four `p-6` cards with `text-3xl font-black` values consume a full row before any content appears, and they are static totals unrelated to any filter.
- **Why it matters:** The loudest element on the page is a number that rarely changes, pushing the actual work below the fold. Passionfroot's strip is half the height and answers "what does my current filter contain?".
- **Change to make:** Halve the height, swap shadow for hairline, move the strip inside the work surface, derive it from the active filter set.
- **Evidence:** `brand-03`, `brand-04`

#### D4 · Removable filter tokens vs. no filtering at all — **High**
- **Passionfroot:** A chip row sits above every list: `Sorted by Collaboration stage`, `Collaboration stage: Any of 10 stages ×`, `Publish period: From Jun 4, 2026 ×`, and a `+` to add another. Each filter is a removable token, so view state is always visible. Brand side adds "View settings" for column configuration.
- **Clipline today:** Only `/discover` has filtering, via a search band plus saved-search pills. `/deals`, `/inbox` and `/campaigns` have none — deals are split into three hardcoded sections (Action needed, In progress, Done).
- **Why it matters:** Hardcoded sections work at ten deals and collapse at a hundred. There is also no way to answer a specific question like "everything awaiting my approval this month".
- **Change to make:** One filter-token bar component backed by URL search params, mounted on every list surface, so views are shareable and bookmarkable.
- **Evidence:** `creator-05`, `brand-03`, `brand-04`

### Flow

#### F1 · Empty states are illustrated, actionable, and distinguish new from filtered — **High**
- **Passionfroot:** Every empty state has a mascot illustration, a headline, one line of explanation, and a next step. The brand inbox offers three suggested prompts with A/B/C keyboard hints. Analytics says "No results match your filters" with a **Reset filters** button. Discover says "More opportunities coming soon" and explains *why* it is empty.
- **Clipline today:** Dashed-border boxes with a generic icon and text. Most carry no action, and there is no distinction between "you are new" and "your filters matched nothing".
- **Why it matters:** Empty states are the majority of what a new user sees in a marketplace waiting for supply. Clipline's read as broken; Passionfroot's read as guidance.
- **Change to make:** Give every list **two** empty states — first-run (explain + primary CTA) and no-results (reset filters) — and commission a small illustration set.
- **Evidence:** `brand-02`, `brand-03`, `brand-04`, `creator-05`, `creator-06`

#### F2 · Setup checklist persists across the app — **Medium**
- **Passionfroot:** A floating card pinned bottom-left of every brand page: "Let's get you set up" with a progress bar, five collapsible steps, strikethrough on completed ones, an inline CTA on the active step ("Create campaign" + "Learn more"), and a minimize control.
- **Clipline today:** The "Finish setup" checklist renders only in the right column of `/dashboard` and disappears the moment the user navigates.
- **Why it matters:** Activation guidance vanishes exactly when the user starts exploring, which is when they most need it.
- **Change to make:** Lift the checklist into the shell as a dismissible, minimizable floating card driven by the same completion query, keeping per-step inline CTAs.
- **Evidence:** `brand-01`

#### F3 · No contextual right panel pattern — **Medium**
- **Passionfroot:** The calendar pairs the main grid with a right panel holding per-calendar visibility toggles (eye icons), color swatches per collaboration, and a "This month" summary. The storefront pairs an edit column with a live preview column.
- **Clipline today:** No right-panel pattern exists. Secondary context becomes a separate page or gets stacked below the primary content.
- **Why it matters:** Editing without seeing the result, and filtering without seeing what the filters refer to, both cost round trips.
- **Change to make:** Add a right-panel slot to the shell; use it first for storefront edit-with-live-preview, the highest-value instance.
- **Evidence:** `creator-03`, `creator-04`

#### F4 · Settings is a scoped section, not one long form — **Medium**
- **Passionfroot:** Settings leaves the app shell entirely: back chevron, "Settings" title, and its own left rail grouped by scope — personal (Account details, Login & Security, Payments) above a divider, then company (Company details, Members, Plans & Billing, Payments). Content is a narrow form column in a wide panel. Every field has label + helper text, disabled fields explain themselves, and the destructive action is isolated below a hairline as a red text link.
- **Clipline today:** `/brand/settings` stacks brand profile, website ingest, products, outreach template and invites into a single `max-w-2xl` form. Creator settings are tabs on `/dashboard`.
- **Why it matters:** One long form means no deep links to a specific setting, a save button whose scope is ambiguous, and personal versus company data mixed together.
- **Change to make:** Split settings into a scoped section with its own rail and one page per concern, each with an independent save.
- **Evidence:** `creator-08`, `brand-05`

#### F5 · AI is the brand-side entry point, not a buried utility — **Medium**
- **Passionfroot:** The brand home *is* an AI composer: "Hey Narayanan, Let's plan your next creator campaign" with a Beta tag, a large prompt input supporting `@` to link a campaign, and an inline upgrade prompt. "Zest" is a top-level nav item, and empty states across inbox and campaigns funnel into Zest prompts.
- **Clipline today:** AI appears as a single "Draft a reply with AI" button inside a conversation thread.
- **Why it matters:** Less a visual gap than a positioning one — Passionfroot makes assistance the first thing a brand sees, and uses it to fill every empty state.
- **Change to make:** Decide deliberately whether Clipline wants an assistant surface. If yes, it belongs on brand home and inside empty states, not hidden in a thread. **This is a product bet, not a UI port** — see §8.
- **Evidence:** `brand-01`, `brand-02`, `brand-03`

#### F6 · Navigation vocabulary is generic rather than the creator's own — **Medium**
- **Passionfroot:** Creator nav reads Home, Inbox, Storefront, Calendar, Payments, Collaborations, Discover — concrete nouns from the creator's actual business.
- **Clipline today:** Creator nav reads Dashboard, Campaigns, Inbox, Deals. "Storefront" — arguably the product's core concept and the thing `DESIGN.md` builds its whole thesis around — is not a destination at all.
- **Why it matters:** "Dashboard" and "Deals" are internal engineering words. Passionfroot's labels double as a description of what a creator can do here.
- **Change to make:** Rename to Home, Inbox, Storefront, Collaborations, Payments, Discover and let the labels carry the positioning.
- **Evidence:** `creator-01`–`creator-07`

#### F7 · No persistent help affordance — **Low**
- **Passionfroot:** A support bubble is always present — Intercom bottom-right on the creator side, a `?` bubble bottom-left on the brand side — plus a Help center entry pinned in the rail.
- **Clipline today:** Neither exists.
- **Why it matters:** In a marketplace where money and deadlines are at stake, no visible way to get help reads as risk.
- **Change to make:** Help entry in the rail's utility group, plus a persistent support bubble in the shell.
- **Evidence:** all 13

### Visual

#### V1 · Hairlines and a background step do the elevation, not shadows — **High**
- **Passionfroot:** Essentially no shadows anywhere. Separation comes from a color step — white cards on a warm beige ground — plus 1px hairlines. Surfaces are flat.
- **Clipline today:** `shadow-card` and `shadow-card-hover` on nearly every surface, and the old `DESIGN.md` explicitly mandated that "shadows do primary elevation" with hairlines demoted to "minor structure only".
- **Why it matters:** **The single largest contributor to the difference in feel**, and it persists even though the palettes are nearly identical. Shadows on every card read soft and consumer; flat surfaces with hairlines read like a tool.
- **Change to make:** Invert the rule. Introduce a distinct rail/ground tone, make cards flat white on it, use hairlines for structure. Reserve shadow for genuinely floating layers — menus, popovers, the floating checklist.
- **Evidence:** all 13

#### V2 · Type scale and weight considerably louder — **High**
- **Passionfroot:** Page titles ~20–24px semibold, body 13–14px, nav labels 13px. A display face appears only for section intros such as "Discover opportunities". Everything else is a tight, quiet sans.
- **Clipline today:** Page titles `text-3xl font-black`, metric values `font-black`, and the old `DESIGN.md` specified a display scale of `clamp(2.2rem, 5vw, 3.6rem)` at weight 900.
- **Why it matters:** Weight-900 headings inside an application shell force hierarchy through shouting instead of spacing and position, and crowd out the data.
- **Change to make:** Cap in-app headings at ~24px semibold, body at 14px, and keep heavy display weights for the landing page and public storefronts where they earn their place.
- **Evidence:** `creator-03`, `creator-06`, `brand-01`, `brand-05`

#### V3 · Radii restrained, pills reserved for a specific job — **Medium**
- **Passionfroot:** Buttons and inputs around 8px. Pills reserved for three roles: active nav item, tab switchers (Active/Archived, Available/Sent), and status chips. Cards ~10–12px.
- **Clipline today:** Buttons and inputs fully rounded, cards 18–24px.
- **Why it matters:** When every control is a pill, the pill stops signalling anything, and fully-rounded text inputs waste horizontal space and weaken the sense of a data-dense grid.
- **Change to make:** Buttons and inputs to 8px, cards to 12px, full rounding reserved for nav-active, tabs, status chips, avatars.
- **Evidence:** `creator-02`, `creator-03`, `creator-06`, `brand-05`

#### V4 · The palette is already close — **Low** *(the good news)*
- See §5. The two grounds are within a couple of percent. The only real gaps: Clipline has **no distinct rail tone**, its ink is noticeably darker than Passionfroot's softer near-black, and its one expressive color is amber where Passionfroot uses green for status and pastels for role.
- **Change to make:** Add a `--rail` token at the deeper beige step, soften ink toward `#2E2D2A`, add pastel role-chip tokens. Amber can stay; it is not what makes the products look different.

---

## 5. Sampled palette

Passionfroot values sampled from screenshot pixels; Clipline values read from
`app/globals.css` as it stood on 2026-09-04.

| Role | Passionfroot | Clipline (old) | Note |
|---|---|---|---|
| Page ground | `#F8F7F3` | `#FAF9F6` | Effectively the same warm off-white |
| Rail / chrome | `#F5F3EA` | *(none)* | **Clipline had no rail tone — the shell depends on this step** |
| Card surface | `#FFFFFF` | `#FFFFFF` | Identical — but Passionfroot adds no shadow |
| Ink | ~`#2E2D2A` | `#1B1917` | Clipline reads harder |
| Primary action fill | ~`#2E2D2A` | `#1B1917` | Passionfroot ~8px radius, Clipline a pill |
| Success / live | `#3DBC85` | `#2E7D4F` | Passionfroot's is brighter, used as a live dot |
| Role chip (Partner) | `#A3DDC0` | *(none)* | No role-chip token existed |
| Role chip (Creator) | `#FFF2EB` bg | *(none)* | Peach |

**Three sampled values were rejected on contrast grounds** when writing
`DESIGN.md`: `#3DBC85` is only 2.24:1 on the ground (below the 3:1 a
state-carrying dot needs), and separately Clipline's inherited `--warn`
`#B07C24` (3.40:1) and `--faint` `#9A958D` (2.78:1) were already failing AA
under the previous system. Do not copy Passionfroot's green verbatim.

## 6. Concrete visual values

| Property | Passionfroot | Clipline (old) |
|---|---|---|
| Card elevation | none (hairline) | 2-layer shadow |
| Card radius | ~12px | 18–24px |
| Button radius | ~8px | `9999px` |
| Input radius | ~8px | `9999px` |
| Page title | ~24px / 600 | ~30px / 900 |
| Body | 13–14px | 16px |
| Nav label | 13px + icon | 14px, no icon |
| Nav orientation | vertical rail | horizontal capsule |
| Rail width | ~220px at 1440 (15% of viewport) | n/a |
| Content width | full bleed | max 72rem, centered |
| Table row height | 44–48px | n/a (cards) |
| Rows per viewport | ~10 | ~6 |

## 7. Surfaces Passionfroot has and Clipline does not

Product gaps rather than styling gaps — listed because several of them are what
make Passionfroot's rail long enough to need grouping in the first place.

| Surface | Contents | Shot |
|---|---|---|
| Calendar & availability | Month grid with bookable slots, blocked slots, external bookings, colored per-collaboration entries with a legend | `creator-04` |
| Wallet & payments | Balance chip in the rail, "Start with FrootWallet" funding card, "Request payment" inline on a to-do row | `brand-01`, `creator-01` |
| Analytics | Post-level impressions, engagement split by reactions/comments/other, engagement rate, average CPM, spend, CSV export, "Get reporting insights" | `brand-04` |
| Storefront stats & sharing | Total views and unique visitors over 7 days, share module with public link, Copy link, Share to… | `creator-03` |
| Live storefront preview | Edit controls left, rendered public storefront live beside it | `creator-03` |
| Inbox archive | Active/Archived toggle with per-row archive on hover | `creator-02` |
| Application tracking | Available/Sent tabs so a creator sees what they've applied to and its status | `creator-06`, `creator-07` |
| Team & billing | Members with seats, Plans & Billing, Notification preferences | `brand-05` |

## 8. Passionfroot patterns worth *not* copying

Adopting the shell and density is the goal; adopting everything is not.

- **`#3DBC85` as a status green.** Fails contrast (§5). Use an accessible green.
- **Greying out inactive partners with a tooltip as the only explanation** (`creator-02`). The state is invisible until hover. Clipline should label it inline.
- **Home-as-AI-composer** (`brand-01`). This is a strategic bet on an assistant being the primary interface, not a layout pattern. Porting the visual treatment without the underlying capability produces a prompt box that does nothing.
- **Upgrade gating woven through the UI.** Lock icons on metrics, "Upgrade to unlock full access" on the home surface, gated Zest. Reasonable for their business model; only adopt it if Clipline's pricing works the same way.
- **A mascot in every empty state.** Charming at first, and it makes twelve empty states look identical. Vary the treatment by whether the state is first-run or no-results.
- **Two separate "Payments" entries in settings** (`brand-05`, personal and company scope). Defensible but genuinely confusing to scan.

## 9. Migration sequence

Sequenced so each phase makes the next cheaper. Phases 1–2 account for most of
the *perceived* difference; phase 3 for most of the difference in how the
product feels to *use*.

1. **Shell.** `AppShell` with fixed left rail (identity + role chip, primary create action, three grouped nav sections) and a full-bleed inset panel. Rename nav to Home / Inbox / Storefront / Collaborations / Payments / Discover.
2. **Flatten the visual language.** Add `--rail`, strip `shadow-card` from in-app surfaces in favour of hairlines plus the ground step, cap in-app headings at 24px/600, body to 14px, buttons and inputs to 8px, cards to 12px.
3. **Convert work queues to dense rows.** Rebuild inbox, deals and campaigns as tables with avatar, preview text, relative time, status chip, and the resolved next action as a button on the row.
4. **Filter-token bar** backed by URL search params, mounted on every list, with the summary metric strip deriving from the active filter set.
5. **Empty states and activation.** Split every list into first-run and no-results states; lift the setup checklist into the shell as a persistent minimizable card.
6. **New surfaces**, in value order: storefront stats + share module, live storefront preview in a right panel, scoped settings section, then calendar and analytics.

## 10. Related documents

| Document | Relationship |
|---|---|
| `DESIGN.md` | **The decisions this analysis produced.** Source of truth for tokens, scale, radii, elevation, layout. Read it before writing UI. |
| `CLAUDE.md` | Enforces the above and lists superseded docs. |
| `UI-PAGES.md` | Page inventory, describing the app **as built under the old system** — current behaviour to be migrated, not the target. |
| `RevEng_PassionFroot.md` | Independent, largely inferred reconstruction. Useful for feature and flow research; **not** a token source, and it contradicts this document's sampled values. |
| `docs/DESIGN-SYSTEM-BRIEF.md` | Product framing and journeys current; styling sections two systems out of date. |
| `.design-sync/` | Generated artifacts for the abandoned crimson/Bricolage system. Ignore. |
