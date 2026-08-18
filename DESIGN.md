# Design System — Clipline ("Booking Ledger")

Approved 2026-08-18 via /design-consultation (variant B of three researched
directions; Codex + independent Claude voices converged on the core).
Supersedes the crimson/Bricolage system. Mockup evidence:
`~/.gstack/projects/InfluencerMarketplace/designs/design-system-20260818/`.

## Product Context
- **What this is:** Two-sided marketplace — video micro-influencers publish bookable storefronts; brands book and track deals through an enforced state machine.
- **Who it's for:** Creators (phones, between shoots) and brand managers (laptops, work hours).
- **Memorable thing:** "Creators look like businesses here." The design's job is to make a 5k-follower creator read like a serious independent studio.
- **Project type:** Web app with public brand surfaces (landing, storefronts).

## Aesthetic Direction
- **Direction:** Booking Ledger — warm editorial paper sharpened by one electric blue. Tactile, composed, quietly energetic. The platform is the paperwork of professional work: rate cards, tear sheets, ledgers.
- **Decoration level:** intentional — rules (1.5px ink lines), paper/ink layering, and composition do the work; no blobs, no glass, no gradients in chrome.
- **Mood:** A well-run studio's front office. Confident, warm, precise.
- **Reference:** Contra's work-forward marketplace restraint; editorial rate-card formats. Anti-references remain: Heepsy green SaaS, purple-gradient startup, crypto-dark, enterprise gray — and the rejected loud-crimson-on-white.

## Typography
- **Display/Hero:** Spectral (500/600 + italic) — serif gravitas for statements, creator names, and rates; the "business" register. (Deliberate swap from Instrument Serif — overused-font watchlist.)
- **Body/UI:** Hanken Grotesk (400/500/600/700) — operational confidence for nav, forms, metadata, controls.
- **Data:** Hanken Grotesk + `font-variant-numeric: tabular-nums` for every price, count, and countdown. No mono-as-costume.
- **Loading:** Google Fonts via next/font (`Spectral`, `Hanken_Grotesk`).
- **Scale:** display `clamp(2.2rem, 5vw, 3.5rem)` Spectral; h2 1.75rem; h3 1.25rem; body 1rem/1.6 (≤70ch); ui/labels 0.875rem 500-600. Headlines sentence case, tight-tracked, never quirky.

## Color
- **Approach:** restrained — paper, ink, one decisive blue. Blue means commercial intent: primary actions, links, active deal states, timers. No secondary rainbow of states — labels and line styles first.
- **Background (paper):** `#F1EFE7`
- **Surface (card stock):** `#FCFBF7`
- **Ink (text):** `#171A18`
- **Muted:** `#6F746E`
- **Rule lines:** ink at 1.5px for structural rules; `#DDD8C9` hairlines for minor dividers
- **Accent (booking blue):** `#315CFF` — white text on blue fills, always
- **Semantic (muted, paper-compatible):** success `#2E7D4F`, warning `#B07C24`, error `#B3362B`
- **Ratings:** ink stars (★ in `#171A18`), value in tabular nums — no amber, no gold
- **Dark mode:** none — light-only is a committed decision.

## Spacing
- **Base unit:** 4px · **Density:** comfortable on app surfaces, generous on brand surfaces
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)

## Layout
- **Approach:** hybrid — creative-editorial on brand surfaces (asymmetric 7/5 tear-sheet compositions, content deliberately crossing the grid, storefront-as-rate-card), grid-disciplined on workflow surfaces.
- **Signature moves:** the storefront reads as an editorial tear sheet (big Spectral name, structured fact rows with prices right-aligned over ink rules); discovery is a talent index with generous rows, not a thumbnail mosaic; the deal timeline renders as a single horizontal ledger rule with stamped states (current = blue, done = ink, future = outlined) and plain-language timers ("Creator response due in 14h").
- **Max content width:** 72rem brand, 56rem forms · **Border radius:** sm 4px, md 8px (buttons/inputs), lg 12px (cards) — editorial, never bubbly; no pills except nowhere.
- **Buttons:** blue fill = the one advancing action; ink outline = secondary; ink text link = tertiary. Destructive-confirm = error-color outline.

## Motion
- **Approach:** minimal-functional; the paper doesn't bounce. 150-250ms ease-out color/opacity transitions; the deal-ticker line may tick. `prefers-reduced-motion` fully honored.

## Accessibility
WCAG AA. Ink on paper ≈ 15:1; muted on paper ≥ 4.6:1; white on booking blue passes large+normal; verify any new pair. Labels on every input; keyboard + visible focus (blue ring); 44px touch targets.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-17 | Crimson/Bricolage "safelight" system | Initial impeccable pass |
| 2026-08-18 | Replaced by Booking Ledger (variant B) | User rejected crimson as harsh/plain/wrong-mood; research + 3-voice convergence on paper/ink/one-blue; approved via comparison board |
| 2026-08-18 | Spectral over Instrument Serif | Overused-font watchlist; same editorial energy |
| 2026-08-18 | Ink ratings, no amber | One-accent discipline: blue = commercial intent only |
