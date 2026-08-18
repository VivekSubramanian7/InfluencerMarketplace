# Design System — Clipline ("Gallery Frame")

Approved 2026-08-18 via /design-consultation (variant A of three researched
directions; user's final pick after seeing all three rendered). Supersedes the
crimson/Bricolage system. Mockup evidence:
`~/.gstack/projects/InfluencerMarketplace/designs/design-system-20260818/`.

## Product Context
- **What this is:** Two-sided marketplace — video micro-influencers publish bookable storefronts; brands book and track deals through an enforced state machine.
- **Who it's for:** Creators (phones, between shoots) and brand managers (laptops, work hours).
- **Memorable thing:** "Creators look like businesses here." The platform designs the frame; the creator supplies the color.
- **Project type:** Web app with public brand surfaces (landing, storefronts).

## Aesthetic Direction
- **Direction:** Gallery Frame — quiet premium chrome around vivid creator identity. Warm near-white ground, near-black ink, black pill CTAs (Contra-style), soft depth. Each creator carries a unique gradient identity; the platform never competes with them for attention.
- **Decoration level:** intentional — soft shadows and generous rounding give warmth and depth; creator gradients and portfolio imagery carry all the color. No gradients in platform chrome, no blobs, no glass.
- **Mood:** A well-lit gallery hosting working professionals. Calm, premium, warm.
- **Reference:** Contra (work-forward marketplace restraint, dark pill CTAs, money-proof badges). Anti-references remain: Heepsy green SaaS, purple-gradient startup, crypto-dark, enterprise gray, and the rejected loud-crimson-on-stark-white.

## Typography
- **Display/Hero + Body/UI:** Satoshi (400/500/700/900) — single premium geometric-humanist family, committed weight contrast. Calm, confident, nothing quirky.
- **Data:** Satoshi + `font-variant-numeric: tabular-nums` for every price, count, and metric.
- **Loading:** Fontshare CDN (`https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900`) or self-hosted woff2 via `next/font/local` (preferred for production).
- **Scale:** display `clamp(2.2rem, 5vw, 3.6rem)` weight 900, tracking −0.02em; h2 1.75rem/700; h3 1.125rem/700; body 1rem/1.6 (≤70ch); ui/labels 0.875rem/500-600.

## Color
- **Approach:** restrained chrome + creator-supplied color. The platform is warm neutrals + ink; per-creator gradients and portfolio thumbnails provide vibrancy; amber appears ONLY as the trust voice.
- **Background:** `#FAF9F6` (warm near-white — deliberately not stark white)
- **Surface (cards):** `#FFFFFF` with soft shadow (`0 1px 2px rgba(27,25,23,.05), 0 6px 20px rgba(27,25,23,.06)`)
- **Ink (text):** `#1B1917`
- **Muted:** `#6B6660`
- **Hairlines:** `#E7E3DC` (minor structure only — shadows do primary elevation)
- **Primary action:** ink pills — `#1B1917` fill, `#FAF9F6` text, `border-radius: 999px`
- **Amber (trust voice only):** `#C9962B` — ★ ratings, Verified badges. Never decorative.
- **Semantic:** success `#2E7D4F`, warning `#B07C24`, error `#B3362B`
- **Creator gradient identities:** each creator gets a deterministic duotone gradient derived from their handle (hash → two hues from a curated warm/cool palette set, e.g. dusty teal→warm sand). Used for identity banners, avatar blocks, and thumbnail placeholders until real video thumbnails exist. This is the system's color engine — richness with zero fake data.
- **Dark mode:** none — light-only is a committed decision.

## Spacing
- **Base unit:** 4px · **Density:** comfortable app, generous brand surfaces
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)

## Layout
- **Approach:** grid-disciplined with soft geometry. Cards `border-radius: 18-24px`; buttons/inputs pill or `12px`; identity banners `24px`.
- **Signature moves:** storefront opens with the creator's gradient identity banner (avatar block, name 900-weight, proof badge floating top-right: "12 deals · ★ 4.8 · Verified"); offerings as white shadow-cards with price right-aligned + ink pill Book; discovery cards carry gradient thumbnail tops + real proof badges (Contra's "$earned" pattern using OUR real deals/ratings data — never fake numbers); deal timeline stays a clear state strip.
- **Max content width:** 72rem brand, 56rem forms.
- **Buttons:** ink pill = the one advancing action; outlined pill = secondary; text link = tertiary; error-outline = destructive-confirm.

## Motion
- **Approach:** minimal-functional; hover lifts ≤2px + shadow ease on cards, 150-250ms ease-out. `prefers-reduced-motion` fully honored.

## Accessibility
WCAG AA. Ink on bg ≈ 14:1; muted on bg ≥ 4.6:1; bg-text on ink pills ≥ 13:1; white proof-badge text sits on gradient banners inside a solid chip (never raw on gradient). Amber is decorative-plus-text only at ≥3:1 sizes with ink nearby. Labels on every input; visible focus ring (ink); 44px targets.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-17 | Crimson/Bricolage "safelight" system | Initial impeccable pass |
| 2026-08-18 | Booking Ledger (variant B) written | First pick from comparison board |
| 2026-08-18 | **Reversed to Gallery Frame (variant A)** | User preference on reflection: calm premium frame, creator-supplied color |
| 2026-08-18 | Satoshi single family | Premium-calm; not on overused lists |
| 2026-08-18 | Amber restricted to trust voice | One expressive color role; chrome stays neutral |
