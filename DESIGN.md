# Design System — Clipline ("Workspace")

Approved 2026-09-04. Supersedes "Gallery Frame" (2026-08-18) and the earlier
crimson/Bricolage system. Direction set by a pixel-level comparison of
Passionfroot's creator and partner workspaces against Clipline's own routes;
evidence in `slack-screenshots/c-research/{creator,brand}` (13 screenshots).
Color values below were **sampled from those screenshots**, not estimated.

**Reasoning behind every decision here:
[`docs/PASSIONFROOT-UI-GAP-ANALYSIS.md`](docs/PASSIONFROOT-UI-GAP-ANALYSIS.md)**
— 19 findings with evidence, plus a screenshot-by-screenshot index so you never
need to re-open the images, and a list of Passionfroot patterns worth *not*
copying.

> `RevEng_PassionFroot.md` is a separate, largely inferred reconstruction. It is
> **not** the source of truth for tokens and several of its values (Inter,
> `#FF9966` primary, shadowed cards) contradict what the screenshots actually
> show. Do not take styling values from it.

## The one rule that matters

Clipline has **two visual registers, and they are not the same**:

| Register | Surfaces | Job | Character |
|---|---|---|---|
| **App** | Everything behind auth: rail, home, inbox, deals, collaborations, discover, settings | Get work done fast | Dense, flat, quiet, tool-like |
| **Public** | Landing (`/`), public storefront (`/c/[handle]`), login/signup | Persuade and impress | Expressive, generous, high-contrast |

The Gallery Frame system was applied uniformly, which is why the authenticated
app reads like a marketing page. **Restraint below applies to the App register.**
The Public register keeps its expressive scale (900 weights, gradient identity
banners, generous radii, hero layouts) — that work stays as-is.

## Product Context
- **What this is:** Two-sided marketplace — video micro-influencers publish bookable storefronts; brands book and track deals through an enforced state machine.
- **Who it's for:** Creators (phones, between shoots) and brand managers (laptops, work hours).
- **Memorable thing:** "Creators look like businesses here." The platform designs the frame; the creator supplies the color.
- **Project type:** Web app with public brand surfaces (landing, storefronts).

## Aesthetic Direction (App register)
- **Direction:** Workspace — a quiet, dense operations tool. Depth comes from *color steps and hairlines*, never from shadow. The chrome recedes so the data and the next action are the loudest things on screen.
- **Decoration level:** minimal. No shadows on in-app surfaces, no gradients in chrome, no hover lifts, no glass, no blobs.
- **Mood:** A well-organised back office. Calm, fast, legible at a glance.
- **Reference:** Passionfroot's creator and partner workspaces — persistent left rail, full-bleed inset work surface, tables over cards, next action on the row.
- **Anti-references:** marketing-page-as-app (shadow cards, 900-weight headings, centered narrow column), Heepsy green SaaS, purple-gradient startup, crypto-dark, enterprise gray.

## Layout — the structural decisions

These are the changes that carry most of the difference in feel. Get them right
before touching color or type.

### Shell
- **Persistent left rail, not a top tab bar.** `flex h-dvh`; rail is fixed `220px` (collapsible to a 56px icon-only strip); main is `flex-1 overflow-y-auto`.
- Rail is flush to the viewport edge and painted `--rail`. Main content is a **rounded inset panel** (`--card`, `radius-panel`, hairline border) floating on `--ground`, so the ground shows at the outer edge.
- **Rail contents, top to bottom:** identity block (avatar, workspace name, role chip, chevron → email + Log out) → primary create action → nav group 1 *core* → hairline → nav group 2 *business* → hairline → spacer → nav group 3 *utility*, pinned to the bottom.
- Every nav item is **icon + label** at 13px. Active state is a `--card` pill with a hairline. Unread counts and "New" badges sit **on the owning item**, never collected into a single global bell.
- A support affordance is always present in the shell.

### Content
- **No global max-width in the App register.** The panel fills the available width. Only *forms* are constrained, to `560px`, inside the panel.
- Optional third pane on the right for context (live storefront preview, calendar layer toggles, record detail). The shell must support a right-panel slot.
- Panel padding `24px`. Card padding `16–20px`.

### Density
- **Rows and tables for things you act on** — inbox, deals, collaborations, applications, payments, notifications.
- **Cards only for things you browse** — discover, portfolio, campaign galleries.
- Table row height `44–48px`. Around 10 rows should fit a laptop viewport.
- **Every queue row carries four things:** identity (avatar + name), meta or preview text, a status chip, and **the resolved next action as a right-aligned button**. A row that only navigates is a bug in a work queue.
- Row hover changes *fill* (`--row-hover`), never elevation or position.
- **Summary metric strips** are compact bordered tiles *inside* the work surface, above the list, derived from the **active filter set**. Not hero KPI cards, not static totals.
- Every list surface gets a **filter-token bar**: removable chips (`Label: value ×`) plus a `+` to add, backed by URL search params so views are shareable.

## Typography
- **Family:** Satoshi (400/500/600/700/900) — already loaded via Fontshare; `font-variant-numeric: tabular-nums` on every price, count, and metric.
- **App scale** (the change — previous system ran roughly one step larger and two weights heavier):

| Role | Size | Weight |
|---|---|---|
| Page title | 24px | 600 |
| Section heading | 18px | 600 |
| Sub-heading | 15px | 600 |
| Body | 14px / 1.5 | 400 |
| Meta, secondary | 13px | 400 |
| Nav label, table header, chip | 12–13px | 500 |
| Uppercase micro-label | 11px, tracking 0.04em | 600 |
| Metric value | 20px | 600, tabular |

- **Weight ceiling in-app is 700, and 700 is rare.** `font-black` / weight 900 is **Public register only**.
- **Public scale** unchanged: display `clamp(2.2rem, 5vw, 3.6rem)` weight 900, tracking −0.02em.
- Headings use `text-wrap: balance`, tracking −0.01em in-app (the old −0.02em is for display sizes).

## Color

Sampled from Passionfroot; adapted, not copied. The two grounds were already
within a couple of percent — the real additions are a **distinct rail tone** and
a **softer ink**.

| Token | Value | Role |
|---|---|---|
| `--ground` | `#F8F7F3` | App background, visible at the panel's outer edge |
| `--rail` | `#F5F3EA` | Nav rail and chrome — deeper warm step. **New token; the shell depends on it** |
| `--card` | `#FFFFFF` | Work surface, cards, table body, active nav pill |
| `--row-hover` | `#F8F7F3` | Row and list-item hover fill |
| `--ink` | `#2E2D2A` | Primary text. Softened from `#1B1917` |
| `--muted` | `#6E6A64` | Secondary text, meta, table headers, **placeholders** |
| `--faint` | `#9A958D` | **Non-text only** — decorative glyphs, icon tints, disabled control labels. Fails AA as body text by design; anything readable uses `--muted` |
| `--border` | `#E9E5DE` | Hairlines — **primary means of elevation** |
| `--divider` | `#F1EEE8` | Table row dividers, lighter than `--border` |
| `--primary` | `#2E2D2A` fill, `#F8F7F3` text | The one advancing action per view |
| `--ok` | `#2E7D4F` | Success, published/live status — both the **dot** and success text |
| `--role-creator` | `#FFF2EB` bg, `#8A4A22` text | Creator role chip |
| `--role-brand` | `#EAF7F0` bg, `#1F6B47` text | Brand/partner role chip |
| `--amber` | `#C9962B` fill, `#2C2412` on-fill text | Trust voice only — ★ ratings, Verified. **A fill, not a text color** |
| `--warn` | `#8F6318` | Warning text and banners |
| `--error` | `#B3362B` | Error, destructive confirm |

Three values deliberately diverge from the sampled Passionfroot palette because
the sampled ones fail WCAG (measured, see Accessibility):

- Passionfroot's live-green `#3DBC85` reaches only **2.24:1** on the ground — below the 3:1 that a state-carrying dot needs. Collapsed into `--ok` `#2E7D4F`; there is no separate `--live` token.
- The inherited `--warn` `#B07C24` was **3.40:1** and had been failing under the previous system too. Darkened to `#8F6318` (4.94:1).
- `--faint` cannot carry readable text at any value light enough to be visually distinct from `--muted`, so it is scoped to non-text use instead of being darkened into uselessness.

### Creator color

**The creator gradient identity engine stays.** The deterministic per-handle
duotone (`lib/identity/gradient.ts`) is the one thing Clipline's visual system
does that Passionfroot's does not, and it is the system's only color engine.
Use it for identity banners, avatar blocks, and thumbnail placeholders. It is
*creator-owned* color, so it belongs on storefronts, discover cards, and
avatars — **never in platform chrome**.

**Dark mode:** none. Light-only remains a committed decision.

## Elevation — inverted from the previous system

The old rule was "shadows do primary elevation, hairlines are minor structure
only." **That is now reversed**, and it is the single biggest contributor to the
difference in feel.

- In-app surfaces are **flat**. Separation comes from the `--ground` → `--rail` → `--card` color steps plus 1px `--border` hairlines.
- **Shadow is permitted only on layers that genuinely float above the page:** dropdowns, popovers, menus, modals, toasts, and the floating setup checklist.
  - `--shadow-float: 0 8px 24px rgb(27 25 23 / 0.12)`
- `shadow-card` and `shadow-card-hover` are **removed from the App register**. They remain available to Public-register surfaces.
- No hover lift anywhere. Hover changes fill or border, not position.

## Spacing
- **Base unit:** 4px · **Density:** compact app, generous public surfaces
- **Scale:** 2xs(2) xs(4) sm(8) md(12) base(16) lg(24) xl(32) 2xl(48)
- Control height: `32px` sm, `36px` default, `40px` lg. Form fields `36px`.

## Radii — restrained, and pills mean something again
- Buttons, inputs, selects, chips-with-input: **8px**
- Cards, tiles, table shells: **12px**
- Inset work panel, modals: **16px**
- **Fully rounded (`9999px`) is reserved for exactly four things:** the active nav item, tab switchers (Active/Archived), status chips, and avatars.
- Pill-shaped text inputs and pill primary buttons are **out**. When every control is a pill, the pill signals nothing.

## Motion
- Minimal-functional. `150ms ease-out` on fill, border, and opacity.
- **No hover lifts, no card entrance staggers, no shimmer.** The previous system's `stat-card` shimmer and `card-grid` stagger are removed in-app.
- `prefers-reduced-motion` fully honored.

## Empty states — two kinds, never one

Every list surface needs both, and they are different states with different copy
and different actions:

1. **First-run** — illustration, headline, one line explaining what will appear here, and a **primary CTA that creates the missing thing**.
2. **No results** — "No results match your filters", plus a **Reset filters** button. Never an illustration; the data exists, the filter is wrong.

A dashed-border box containing an icon and a sentence, with no action, is not an
empty state. It is a dead end.

## Accessibility

WCAG AA. Every ratio below was computed from the hex values above, not
estimated — re-run the check if you change a token.

| Pair | Ratio | Required | |
|---|---|---|---|
| `--ink` on `--ground` | 12.85:1 | 4.5 | pass |
| `--ink` on `--card` | 13.77:1 | 4.5 | pass |
| `--ink` on `--rail` | 12.39:1 | 4.5 | pass |
| `--muted` on `--ground` | 5.01:1 | 4.5 | pass |
| `--muted` on `--rail` | 4.83:1 | 4.5 | pass |
| `--primary` text on `--primary` fill | 12.85:1 | 4.5 | pass |
| `--ok` on `--ground` | 4.71:1 | 4.5 | pass |
| `--error` on `--ground` | 5.63:1 | 4.5 | pass |
| `--warn` on `--ground` | 4.94:1 | 4.5 | pass |
| Creator chip text on chip fill | 6.21:1 | 4.5 | pass |
| Brand chip text on chip fill | 5.86:1 | 4.5 | pass |
| `--amber` on-fill text (`#2C2412`) | 5.76:1 | 4.5 | pass |

Rules that follow from the numbers:
- **`--amber` is never a text or icon color on a light ground** (2.49:1). It is a badge/chip fill with `#2C2412` on top. ★ glyphs are permitted at ≥20px only, and the numeric rating always appears beside them so the rating is never conveyed by color alone.
- **`--faint` is never used for text a user needs to read.** Disabled control labels are exempt from 1.4.3; placeholders are not, so placeholders use `--muted`.
- Status is **never conveyed by color alone.** Every dot carries an adjacent ink text label, which is what keeps the status system compliant under 1.4.11.
- Labels on every input; visible focus ring (`--ink`, 2px, 2px offset); 44px minimum touch targets on mobile.

## Do not
- Put `shadow-card` on an in-app surface.
- Use `font-black` or weight 900 behind auth.
- Wrap a work queue's items in cards.
- Ship a list row whose only affordance is navigation.
- Add a `max-w-*` container to an App-register page shell.
- Make a text input or a primary button fully rounded.
- Build a list without a filter-token bar and both empty states.
- Collect per-section unread counts into one global bell.
- Use `--amber` or `--faint` as a text color.
- Convey a status with a colored dot alone, without an adjacent text label.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-17 | Crimson/Bricolage "safelight" system | Initial impeccable pass |
| 2026-08-18 | Booking Ledger (variant B) written | First pick from comparison board |
| 2026-08-18 | Gallery Frame (variant A) adopted | Calm premium frame, creator-supplied color |
| 2026-08-18 | Satoshi single family | Premium-calm; not on overused lists |
| 2026-08-18 | Amber restricted to trust voice | One expressive color role; chrome stays neutral |
| 2026-09-04 | **App/Public register split** | Gallery Frame applied uniformly made the authenticated app read as a marketing page. Public surfaces keep the expressive scale |
| 2026-09-04 | **Persistent left rail replaces top tab bar** | A horizontal capsule caps at ~5 items, which forced Storefront/offerings/portfolio behind `?tab=` params. A rail carries 9 destinations and gives each a fixed position |
| 2026-09-04 | **Full-bleed inset panel replaces centered `max-w-6xl`** | Centered column wasted the viewport and foreclosed master–detail layouts |
| 2026-09-04 | **Rows/tables for work, cards for browsing** | Card-per-conversation showed ~6 items with no preview; a table shows ~10 with preview, time, and hover actions |
| 2026-09-04 | **Next action moves onto the row** | The deal state machine was actionable only from `/deals/[id]`, making Clipline's anti-ghosting differentiator its slowest path |
| 2026-09-04 | **Elevation inverted: hairlines primary, shadow floating-only** | Largest single contributor to the difference in feel, independent of palette |
| 2026-09-04 | **Type capped at 24px/600 in-app; radii tightened; pills reserved** | Hierarchy through spacing and position rather than weight |
| 2026-09-04 | **Added `--rail`, softened `--ink`, added role-chip tokens** | Sampled palette was already ~within 2% except for these three gaps |
| 2026-09-04 | **Rejected Passionfroot's `#3DBC85`; darkened `--warn`; scoped `--faint` to non-text** | Measured contrast: 2.24:1, 3.40:1 and 2.78:1 respectively. The old `--warn` had been failing AA while the previous DESIGN.md claimed compliance |
| 2026-09-04 | Creator gradient engine retained | The one place Clipline's visual system beats the reference |
