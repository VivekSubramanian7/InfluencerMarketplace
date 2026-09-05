@AGENTS.md

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

### Current direction: "Workspace" (2026-09-04)
DESIGN.md was rewritten to move the authenticated app toward Passionfroot's
workspace patterns. Two things follow from that, and agents get them wrong by
default:

1. **There are two visual registers.** The App register (everything behind auth)
   is dense, flat, and quiet. The Public register (landing, `/c/[handle]`,
   auth pages) keeps the expressive scale. Do not apply App restraint to public
   surfaces, and do not apply Public expressiveness behind auth.
2. **Several rules are inversions of the previous system.** Hairlines now do
   elevation and shadow is for floating layers only; type caps at 24px/600
   in-app; buttons and inputs are 8px, not pills; App pages have no
   `max-w-*` container. If you find yourself reproducing `shadow-card`,
   `font-black`, `rounded-full` buttons, or `mx-auto max-w-6xl` in an
   authenticated page, you are following the old system.

Much of the existing code still implements the old system. Encountering
`shadow-card` or `text-3xl font-black` in an app route is a finding to report,
not a precedent to copy.

### Superseded — do not take styling values from these
- `.design-sync/conventions.md` and `.design-sync/*.css` — generated artifacts
  describing the abandoned crimson/Bricolage system. Two systems out of date.
- `RevEng_PassionFroot.md` — a largely self-declared "inferred" reconstruction.
  Useful later for feature and flow research; **not** a token source. Its
  palette, font, and shadow values contradict the screenshot evidence.
- `docs/DESIGN-SYSTEM-BRIEF.md` — strategy and journeys are still current; its
  specific radius, container, and chip values are not.
- Any `docs/superpowers/plans/*` older than 2026-09-04 that restates tokens.

### Why the direction is what it is
`docs/PASSIONFROOT-UI-GAP-ANALYSIS.md` holds the reasoning behind every rule in
DESIGN.md: 19 findings with evidence, a screenshot-by-screenshot index (read it
instead of re-opening the images — that analysis does not need redoing), the
sampled palette, and a list of Passionfroot patterns worth *not* copying.

Read it when you need to know *why* a rule exists, or before proposing a
deviation. Read DESIGN.md when you need to know *what* the rule is.

Raw evidence: `slack-screenshots/c-research/{creator,brand}` (13 screenshots).
