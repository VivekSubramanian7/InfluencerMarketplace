# Motion System — "Cabinet of Curiosities"

Derived from `design_tests/Create_a_video_of_a_butterfly.mp4`. A six-phase
choreography for collage assembly, flight, dissolution, and typographic
landing.

## Principles

1. **Assemble, don't appear.** Objects are built from fragments, never pop in
   whole. Even a button should feel like pieces sliding into place.
2. **Paper physics.** Everything moves like paper: light, drifty, subject to
   gentle air resistance. No hard mechanical motion, no elastic bounce.
3. **Subject first, scatter second.** The primary object assembles and settles
   before ornamental fragments bloom outward.
4. **Dissolution is forward motion.** Exit isn't fade-out — it's the subject
   flying away and shedding fragments behind it. Energy carries forward.
5. **Typography arrives on a clean stage.** Text only appears after the
   decorative layer has fully cleared or settled to minimal.

## Easing

| Token | Value | Use |
|-------|-------|-----|
| `--ease-paper` | `cubic-bezier(0.25, 0.1, 0.25, 1)` | Primary — gentle, natural, paper-in-air |
| `--ease-settle` | `cubic-bezier(0.16, 1, 0.3, 1)` | Fast attack → soft landing (wing snap) |
| `--ease-drift` | `cubic-bezier(0.4, 0, 0.2, 1)` | Ambient float, petal fall, scatter drift |
| `--ease-linear` | `linear` | Continuous rotation on gears/fragments |

## Duration Scale

| Token | Value | Use |
|-------|-------|-----|
| `--dur-snap` | `200ms` | Wing fold/unfold, fragment snap into place |
| `--dur-assemble` | `500ms` | Single piece sliding into a collage |
| `--dur-entrance` | `800ms` | Full subject assembly sequence |
| `--dur-bloom` | `600ms` | Ornament scatter outward from subject |
| `--dur-flight` | `1200ms` | Subject translating across viewport |
| `--dur-dissolve` | `800ms` | Subject breaking into trailing fragments |
| `--dur-text` | `500ms` | Typography fade/slide in after clear |
| `--dur-ambient` | `4-10s` | Continuous petal drift, gear rotation |

## Choreography — The Six Phases

Generalized from the butterfly video's 10-second arc:

```
Phase 1 — Collage Reveal (0ms)
  Torn paper edges slide apart, background layers become visible.
  2-3 paper textures crossfade with slight parallax offset.
  Duration: ~600ms

Phase 2 — Subject Assembly (600ms)
  The primary object builds from pieces. Wings unfold, map texture
  fills in, circuit veins trace on. Symmetrical, center-axis.
  Each piece: opacity 0→1, translate from origin, --ease-settle.
  Stagger: 80ms between pieces.
  Duration: ~800ms

Phase 3 — Ornament Bloom (1400ms)
  Small decorative fragments (flowers, gears, mini-butterflies)
  scale(0)→scale(1) and scatter outward from the subject center.
  Random delays 100-400ms. Random rotation ±30deg.
  Duration: ~600ms

Phase 4 — Flight / Action (2000ms)
  Subject tilts (rotate ±15deg), translates across viewport.
  Background layers parallax-scroll at different rates.
  Subject has motion blur suggestion (slight scale on trailing edge).
  Duration: ~1200ms

Phase 5 — Dissolution (3200ms)
  Subject sheds fragments: petals, leaf bits, smaller butterflies.
  Fragments trail behind with --ease-drift, scale down, fade.
  Main subject exits viewport or scales to 0.
  Duration: ~800ms

Phase 6 — Text Landing (4000ms)
  Stage is clean (paper ground + grid only).
  One ornament remains (wireframe butterfly, bottom-left).
  Display text fades in: opacity 0→1, translateY(20px)→0.
  Duration: ~500ms
```

## CSS Implementation

```css
:root {
  --ease-paper: cubic-bezier(0.25, 0.1, 0.25, 1);
  --ease-settle: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-drift: cubic-bezier(0.4, 0, 0.2, 1);
  --dur-snap: 200ms;
  --dur-assemble: 500ms;
  --dur-entrance: 800ms;
  --dur-bloom: 600ms;
  --dur-flight: 1200ms;
  --dur-dissolve: 800ms;
  --dur-text: 500ms;
}

/* ── Torn-paper reveal ── */
.collage-reveal {
  opacity: 0;
  transform: translateX(-30px) rotate(-1deg);
  transition: opacity var(--dur-assemble) var(--ease-paper),
              transform var(--dur-assemble) var(--ease-paper);
}
.collage-reveal.visible {
  opacity: 1;
  transform: translateX(0) rotate(0);
}

/* ── Subject assembly ── */
.assemble {
  opacity: 0;
  transform: scale(0.8) translateY(20px);
  transition: opacity var(--dur-entrance) var(--ease-settle),
              transform var(--dur-entrance) var(--ease-settle);
}
.assemble.visible {
  opacity: 1;
  transform: scale(1) translateY(0);
}

/* Stagger children (wing pieces, collage layers) */
.assemble-stagger > *:nth-child(1) { transition-delay: 0ms; }
.assemble-stagger > *:nth-child(2) { transition-delay: 80ms; }
.assemble-stagger > *:nth-child(3) { transition-delay: 160ms; }
.assemble-stagger > *:nth-child(4) { transition-delay: 240ms; }
.assemble-stagger > *:nth-child(5) { transition-delay: 320ms; }

/* ── Ornament bloom (flowers, gears, fragments) ── */
.bloom {
  opacity: 0;
  transform: scale(0) rotate(0deg);
  transition: opacity var(--dur-bloom) var(--ease-settle),
              transform var(--dur-bloom) var(--ease-settle);
}
.bloom.visible {
  opacity: 1;
  transform: scale(1) rotate(var(--bloom-rotation, 0deg));
}

/* ── Flight translate ── */
.flight {
  transition: transform var(--dur-flight) var(--ease-paper);
}
.flight.active {
  transform: translate(var(--flight-x, 100px), var(--flight-y, -50px))
             rotate(var(--flight-tilt, 12deg));
}

/* ── Dissolution / fragment trail ── */
.dissolve {
  transition: opacity var(--dur-dissolve) var(--ease-drift),
              transform var(--dur-dissolve) var(--ease-drift);
}
.dissolve.exit {
  opacity: 0;
  transform: translate(var(--dissolve-x, 40px), var(--dissolve-y, 20px))
             scale(0.3) rotate(var(--dissolve-spin, 45deg));
}

/* ── Text landing (after dissolution) ── */
.text-land {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity var(--dur-text) var(--ease-paper),
              transform var(--dur-text) var(--ease-paper);
}
.text-land.visible {
  opacity: 1;
  transform: translateY(0);
}
```

## Ambient Motion

Ongoing loops for decorative elements that persist after entrance:

```css
/* Petal drift — slow falling/floating */
@keyframes petal-drift {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  25% { transform: translate(8px, 15px) rotate(12deg); }
  50% { transform: translate(-5px, 30px) rotate(-8deg); }
  75% { transform: translate(12px, 45px) rotate(15deg); }
}

/* Gear rotation — continuous, slow */
@keyframes gear-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Wireframe butterfly wing flutter */
@keyframes wing-flutter {
  0%, 100% { transform: scaleX(1); }
  50% { transform: scaleX(0.85); }
}
```

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Pressed flower | `petal-drift` | 6-10s | `--ease-drift` |
| Clockwork gear | `gear-spin` | 8-14s | `linear` |
| Wireframe butterfly | `wing-flutter` | 2-3s | `--ease-paper` |
| Seed/leaf fragment | `petal-drift` (variant) | 5-8s | `--ease-drift` |

## Interaction Motion

| Interaction | Motion | Duration | Easing |
|-------------|--------|----------|--------|
| Card hover | Lift 3px + paper shadow deepen + slight rotate(0.5deg) | 200ms | `--ease-paper` |
| Button press | scale(0.97) | 100ms | `--ease-settle` |
| Collage element hover | Pull forward (scale 1.02) + brighten | 200ms | `--ease-paper` |
| Section enter (scroll) | Torn-edge reveal from side | 600ms | `--ease-paper` |
| Modal enter | Assemble from center (scale 0.9 → 1 + fade) | 300ms | `--ease-settle` |
| Modal exit | Dissolve outward (scale 1 → 0.95 + fade) | 250ms | `--ease-drift` |

## Parallax Layers

The video uses 2-3 paper layers moving at different rates during flight:

| Layer | Speed | Content |
|-------|-------|---------|
| Background | 1x (static or near-static) | Grid paper ground |
| Middle | 1.3x | Botanical / map panels |
| Subject | 1.6x | Primary collage object |
| Foreground | 2x | Floating fragments, petals |

For scroll-parallax on the web, keep it subtle: `translateY(calc(var(--scroll) * -0.05))` on middle layer, `* -0.12` on foreground. Never on text.

## Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .collage-reveal, .assemble, .bloom, .text-land {
    opacity: 1;
    transform: none;
    transition: none;
  }
  .flight, .dissolve {
    transition: none;
  }
  [class*="petal-drift"],
  [class*="gear-spin"],
  [class*="wing-flutter"] {
    animation: none;
  }
}
```

All decorative animations stop. Assembly and dissolution snap to final/initial
state. Content remains fully accessible.

## Where to Use What

| Element | Motion pattern | Notes |
|---------|---------------|-------|
| Hero section | Full 6-phase choreography | Collage reveal → assembly → bloom → hold |
| Section entrance | Torn-paper reveal (Phase 1 only) | IntersectionObserver trigger |
| Feature cards | Assemble + stagger | Children slide into grid position |
| Stat/number reveal | Text landing (Phase 6) | After parent section settles |
| Background ornaments | Ambient drift loops | 3-5 per viewport max |
| Page transitions | Dissolution → text landing | Exit current → enter next |
| Loading states | Gear rotation | Single element, centered |
