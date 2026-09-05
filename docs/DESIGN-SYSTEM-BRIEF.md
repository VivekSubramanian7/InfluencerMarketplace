# Clipline — Product & Design System Brief

Handoff document for frontend/design-system work. Self-contained: everything a
designer or frontend developer needs to build or extend the system without
spelunking the codebase. Source of truth for strategy is `PRODUCT.md`; for
implemented tokens, `DESIGN.md` + `app/globals.css`.

> **Styling sections are superseded (2026-09-04).** Sections covering
> typography, shape/space/elevation, and the signature composites below still
> describe the abandoned **crimson / weight-800** system — two design systems
> out of date. `DESIGN.md` is the only source of truth for color, type, radii,
> elevation, and layout.
>
> Still current and worth reading: the product framing, the user journeys, the
> role model, and the *behavioural* rules embedded in the composites — that
> off-platform payment banners are never dismissible, that unverified numbers
> are never rendered, that status chips avoid a per-status rainbow. Those
> survive the restyle; their class lists do not.

---

## 1. What Clipline is

Clipline is a two-sided marketplace where **video micro-influencers**
(1k–100k followers on TikTok, YouTube, Instagram Reels) publish bookable
storefronts with productized offerings at transparent prices, and **brands**
discover, book, and track sponsorship deals through an enforced state machine —
briefs, previews, revision caps, anti-ghosting timers, messaging, mark-as-paid
tracking, and two-sided reviews. An **admin** role resolves disputes and
reports.

The product's core promise, and therefore the design's core job: **make a small
creator look like a professional business, and make booking one feel safer than
a DM.** Trust mechanics (verification states, timers, audit trails, escrow
banners) are brand features to be made visible, not fine print.

## 2. Users and their journeys

| User | Context | Primary journey |
|---|---|---|
| Creator | On a phone between shoots; time-poor, energized | Sign up → build profile → add offerings + portfolio → publish storefront → accept/run deals → get reviewed |
| Brand manager | Laptop, work hours | Sign up → discover creators (filters) → open storefront → book with brief → track deal → approve → review |
| Admin | Operator triaging | /admin → resolve disputes (release/refund) → resolve reports → suspend/unsuspend creators |

## 3. Surface inventory

**Brand register** (design IS the product — loud, committed color):
- `/` — landing. Asymmetric hero (copy left, deal-pipeline panel on dark band right), two-audience section, numbered "How a deal runs" (a real sequence), crimson closing band.
- `/c/[handle]` — public creator storefront (ISR, cached). Dark identity band (avatar block, name, rating, niches), audience verification cards, offerings with prices + Book CTAs, brand reviews, portfolio links.

**Product register** (design SERVES the workflow — same tokens, quiet):
- `/signup`, `/login`, `/auth/error` — centered auth cards
- `/discover` — search band with filter chips + creator card grid + pagination
- `/dashboard` (+ `/profile`, `/offerings`, `/portfolio`) — creator workspace: setup checklist, forms, CRUD lists
- `/deals`, `/deals/[id]` — pipeline list (Action needed / In progress / Done) and deal detail (state strip, brief, deliverables, actions, messages, timeline, review form)
- `/book/[offeringId]` — booking brief form
- `/report` — report-a-problem form
- `/admin`, `/admin/deals/[id]` — disputes, reports, creator suspension

Shared chrome: `SiteNav` (sticky, wordmark + role-aware links + logout) on all
authenticated pages. Public pages carry their own light header/footer.

## 4. Brand foundation

**Personality:** confident, creator-native, precise. "The confidence of someone
who knows their rate." Energy without chaos.

**Anti-references (hard constraints):**
- No Heepsy/influencer-SaaS green-CTA look (their UX patterns — filter chips, metric cards, verification checkmarks — are adopted; their visual identity is rejected)
- No generic purple-gradient startup aesthetic; no gradient text
- No dark crypto/neon dashboards; no decorative glassmorphism
- No corporate gray tables with default blue buttons

**Design principles:**
1. Trust is visible — verification, timers, banners are designed features
2. The creator is the hero — platform chrome stays behind them
3. One system, two volumes — brand surfaces loud, workflow surfaces quiet, nothing off-system
4. State is always legible — every deal screen answers "where is this and whose move is it?"
5. No costume — no fake stats, no tech cosplay, every visual claim maps to a real mechanism

## 5. Tokens (implemented in `app/globals.css`, OKLCH, light-only)

### Color

| Token | OKLCH | Usage |
|---|---|---|
| `--background` | `1 0 0` | Page ground. Pure white — never tint it |
| `--foreground` | `0.205 0.02 27` | Body text (ink; ≥7:1 on bg) |
| `--primary` | `0.464 0.169 26.9` | **Crimson** — the identity. CTAs, prices, wordmark, brand bands. ALWAYS white/near-white text on crimson fills |
| `--primary-foreground` | `0.985 0.005 27` | Text on primary |
| `--brand-deep` | `0.36 0.14 27` | Hover/active crimson, deep accents |
| `--band` | `0.17 0.015 27` | Near-black warm band — hero panels, storefront identity headers. Brand surfaces ONLY |
| `--band-foreground` | `0.97 0.005 27` | Text on band |
| `--amber` | `0.86 0.12 85` | Second voice: ratings (★), Verified badges, attention states (disputed, awaiting approval), off-platform payment banners. Ink-dark text on amber fills |
| `--amber-foreground` | `0.28 0.05 60` | Text on amber |
| `--secondary` / `--muted` | `0.965 0.006 27` | Card wells, section tints, chips |
| `--muted-foreground` | `0.49 0.015 27` | Secondary text (≥4.5:1 on white) |
| `--border` / `--input` | `0.9 0.008 27` | Hairlines everywhere |
| `--destructive` | `0.505 0.19 27` | Errors, destructive action accents |
| `--ok` | `0.55 0.12 150` | Success/done states |
| `--warn` | `0.62 0.14 60` | Caution states |
| `--ring` | = primary | Focus rings |

Color strategy: **Committed** on brand surfaces (crimson/band carry 30–60% of
hero and closing sections), **Restrained** on workflow surfaces (white + ink +
hairlines; crimson only on the primary action and price emphasis; amber only
for state).

### Typography

Single family: **Bricolage Grotesque** (Google Fonts, variable; weights
300–800). One family, committed contrast — no second font.

| Role | Spec |
|---|---|
| Display (hero) | 800, `clamp(2.4rem, 6vw, 4.2rem)`, line-height 1.05, letter-spacing −0.03em |
| Page title | 800 (`text-3xl`), tracking-tight |
| Section heading | 700 (`text-xl`/`text-lg`) |
| Body | 400, 1rem, line-height 1.6, max 65–70ch |
| UI/labels/buttons | 500–600, `text-sm` |
| Metrics/prices | 800 + `font-variant-numeric: tabular-nums` |

h1–h3 get `text-wrap: balance` (global). Selection color: crimson at 18%.

### Shape, space, elevation

- Radius scale from `--radius: 0.75rem`: chips/pills `rounded-full`, inputs/buttons `rounded-lg`, cards `rounded-xl`, feature panels `rounded-2xl`
- Layout containers: brand `max-w-6xl`, forms `max-w-2xl`, content `max-w-4xl`, all `px-6`
- Section rhythm: `py-10` app pages, `py-16`–`py-24` brand folds
- Elevation: borders do the work; shadows only `shadow-md` on card hover and `shadow-2xl` on the hero panel. No decorative shadows
- z-scale: dropdown 10 → sticky nav 20 → backdrop 30 → modal 40 → toast 50

## 6. Component inventory

Base primitives are **shadcn/ui** (radix base) restyled by the tokens:
`Button`, `Card`, `Input`, `Textarea`, `Badge`, `Label`, `Separator` in
`components/ui/`. Extend the set via `npx shadcn add <component>` and re-skin
with tokens — never introduce off-system colors.

Signature composites (patterns to keep consistent):

- **Creator card** (discovery grid): initial-letter avatar block (white-on-crimson `rounded-xl`), name + @handle·country, 2-line bio clamp, ≤3 niche `Badge variant="secondary"`, footer "From **$X** · N offerings" with crimson tabular price; whole card is a link with `hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md`
- **Filter chip row** (discovery): pill inputs/selects (`h-10 rounded-full border bg-background px-4 text-sm`) inside a `rounded-2xl border bg-secondary/50` search band; primary Search button also pill
- **Identity band** (storefront): `bg-band` header with 80px crimson avatar block, display name, muted @handle line with amber ★ rating, white/10 niche badges
- **Deal state strip** (deal detail): `rounded-lg bg-secondary px-4 py-3 font-semibold` naming the state; amber-tinted when disputed/awaiting-approval
- **Off-platform payment banner**: `border-amber bg-amber/15` — always visible on off-platform deals, never removable
- **Verification badge**: amber `Badge` "Verified" with stats; otherwise an honest dashed-border pending panel — never render unverified numbers
- **Message bubbles**: mine `bg-primary text-primary-foreground` right-aligned, theirs `bg-secondary` left-aligned, in a `flex-col` list
- **Setup checklist row**: `bg-ok` white-check circle when done, bordered circle when pending, label links to the step
- **Status chips**: `Badge variant="secondary"` default; amber Badge for attention states. No per-status rainbow
- **Error banner**: `rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive`; success = same shape with `--ok`
- **Empty state**: `rounded-xl border border-dashed p-8 text-center text-muted-foreground` + one action

Button semantics: primary crimson = the one advancing action; `variant="outline"`
= secondary; outline + `text-destructive border-destructive/40` = confirm-class
actions (cancel, decline, dispute, refund); `variant="ghost"` = chrome (logout).

## 7. Interaction & motion

- Micro-interactions only on workflow surfaces: 150–250ms color/transform transitions, ease-out; card hover lift ≤2px
- One orchestrated entrance allowed on the landing hero only
- Everything honors `prefers-reduced-motion: reduce` (global override already in `globals.css` — keep it)
- Focus: visible `focus-visible` ring (crimson) on all interactive elements — never remove
- Forms are server-action `<form>`s; feedback arrives via `?error=` / success query params rendered as banners. Preserve this pattern; don't convert to client state without a product reason

## 8. Accessibility (WCAG AA, non-negotiable)

- Body text ≥4.5:1 on its background; large text ≥3:1 (current tokens pass — check any new combination)
- White text on crimson fills, ink text on amber fills (Helmholtz-Kohlrausch rule: saturated mid-luminance fills take light text)
- Every input has a `<Label htmlFor>` or `aria-label`; star ratings carry `aria-label="N out of 5 stars"`; decorative glyphs `aria-hidden`
- Keyboard navigable, ≥44px touch targets on mobile, pagination/nav landmarks labeled

## 9. Hard bans

Gradient text · glassmorphism · side-stripe borders (`border-l-4` accents) ·
uppercase tracked eyebrow labels above sections · dark bands on workflow pages ·
nested cards · arbitrary z-indexes · fake/placeholder statistics · a second
typeface · dark mode (light is a committed decision, not an omission)

## 10. Voice

Confident and concrete. "The price is the price." "Ghosting isn't possible."
Errors are helpful, specific, and never expose raw database text (see
`lib/errors.ts` pattern: mapped codes → business copy passthrough → generic
fallback). Numbers are real or absent.
