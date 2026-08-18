# Design

## Theme

Light, committed-color. Pure white ground; a deep **crimson** (the "safelight" red) carries identity on brand surfaces (hero bands, primary CTAs, storefront accents), with **amber** as the second voice for ratings, badges, and highlights. App surfaces use the same tokens at low volume: white + ink + hairlines, crimson reserved for the primary action, amber for state.

Color strategy: **Committed** on brand surfaces (crimson carries 30–60% of the hero/footer bands), **Restrained** on workflow surfaces.

## Color Palette (OKLCH)

| Token | Value | Role |
|---|---|---|
| `--bg` | `oklch(1 0 0)` | page ground (pure white, no hidden warmth) |
| `--surface` | `oklch(0.965 0.006 27)` | cards, wells, section tints |
| `--ink` | `oklch(0.205 0.02 27)` | body text (≥7:1 on bg) |
| `--muted` | `oklch(0.49 0.015 27)` | secondary text (≥4.5:1 on bg) |
| `--line` | `oklch(0.9 0.008 27)` | hairline borders |
| `--primary` | `oklch(0.464 0.169 26.9)` | crimson — CTAs, brand bands; ALWAYS white text on fills |
| `--primary-deep` | `oklch(0.36 0.14 27)` | hover/active, dark brand bands |
| `--accent` | `oklch(0.86 0.12 85)` | amber — ratings, badges, highlights; ink text on fills |
| `--ok` | `oklch(0.55 0.12 150)` | success states |
| `--warn` | `oklch(0.62 0.14 60)` | attention states |

Dark crimson band (`--primary-deep` or near-black `oklch(0.17 0.015 27)`) is the drench move for hero/footer on brand surfaces only.

## Typography

Single family, committed contrast: **Bricolage Grotesque** (variable, via `next/font/google`) — characterful grotesque that reads creator-native without costume.

- Display: 800, `clamp(2.4rem, 6vw, 4.5rem)`, letter-spacing −0.03em, `text-wrap: balance`
- H2/H3: 700, modular ×1.3 steps
- Body: 400, 1rem/1.6, max 70ch
- UI labels/buttons: 600
- Metrics: `font-variant-numeric: tabular-nums`

## Components

Base: **shadcn/ui** primitives (button, card, input, select, textarea, badge, label, separator) restyled onto the tokens above — radius 0.75rem, hairline borders, no shadows except one soft elevation for popovers/dialogs.

Signature pieces:
- **Creator card** (discovery): avatar block (initial-letter on crimson if no image), name/@handle, niche pills, "From $X" price line, amber ★ rating when present
- **Filter chip row** (discovery): pill-shaped selects, Heepsy-pattern UX with our skin
- **Deal state banner**: full-width tinted strip naming the state + whose move it is
- **Verification badge**: amber pill "Verified" / muted "Verification pending" — never fake numbers
- **Off-platform payment banner**: amber-tinted, always visible on off-platform deals

## Layout

- Brand pages: single-purpose folds, asymmetric hero (copy left, product-in-action panel right on a deep band), fluid `clamp()` spacing
- App pages: centered column ≤ 72rem, page title + primary action on one row, generous section spacing (2.5rem+)
- Responsive grids: `repeat(auto-fit, minmax(280px, 1fr))`
- z-scale: dropdown 10 → sticky 20 → backdrop 30 → modal 40 → toast 50

## Motion

Ease-out-quart, 150–250ms micro-interactions (hover lifts ≤2px, color transitions). One orchestrated entrance on the landing hero only (staggered copy + panel fade-rise). Everything gated by `@media (prefers-reduced-motion: reduce)` → instant.

## Imagery

Product-in-action panels (real UI mockups) are the primary imagery on brand surfaces — the Heepsy pattern done in our skin. Creator-supplied portfolio links carry their own imagery. Avatar fallback: initial letter, white-on-crimson. No decorative stock filler.
