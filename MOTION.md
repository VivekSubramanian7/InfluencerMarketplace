# Motion Design System — Clipline

Derived from `design_tests/Scene.mp4` (Jitter.video reference). Extends
DESIGN.md's "minimal-functional" motion direction with a choreography language
for page entrances, transitions, and ambient decoration.

## Principles

1. **Content leads, decoration follows.** Text and CTAs enter first; particles
   and ornaments bloom after the content is readable.
2. **Staggered cascade, not simultaneous.** Siblings enter 80-120ms apart, top
   to bottom. Simultaneous reveals feel flat; stagger gives hierarchy.
3. **Warm stillness as default.** Most of the UI is static. Motion is reserved
   for entrances, state changes, and one ambient ornament layer per viewport.
4. **Ink on warm ground.** All motion elements use the existing palette — ink
   dots, ink text, warm-white canvas. No new colors for motion.
5. **Loop-clean.** Any animation that loops must pass through a clean slate —
   no jarring jump-cuts.

## Easing

| Token | Value | Use |
|-------|-------|-----|
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Primary entrance/exit — fast attack, gentle settle (spring-like) |
| `--ease-subtle` | `cubic-bezier(0.4, 0, 0.2, 1)` | Ambient drift, hover lifts |
| `--ease-linear` | `linear` | Continuous rotation or looping drift only |

## Duration Scale

| Token | Value | Use |
|-------|-------|-----|
| `--dur-fast` | `150ms` | Hover states, micro-feedback |
| `--dur-normal` | `400ms` | Single element entrance/exit |
| `--dur-entrance` | `600ms` | Primary content entrance (hero headline) |
| `--dur-stagger` | `100ms` | Delay between siblings in a cascade |
| `--dur-ambient` | `6-14s` | Continuous background drift loops |

## Entrance Choreography

The Scene.mp4 pattern, generalized:

```
Phase 1 (0ms):       Label fades in             opacity 0→1, translateY(12px)→0
Phase 2 (100ms):     Headline slides up          opacity 0→1, translateY(24px)→0
Phase 3 (200ms):     CTA pill grows from dot     border-radius circle→pill, width 48px→auto, scale(0)→scale(1)
Phase 3b (400ms):    CTA label fades in          opacity 0→1 inside the pill (text appears after shape settles)
Phase 4 (500ms):     Particles bloom outward     scale(0)→scale(1), scatter from origin
```

### CTA Pill-from-Dot Entrance

The signature CTA motion from Scene.mp4: the button starts as a small ink
circle (the dot), expands horizontally into its pill shape, then the label
text fades in. Three-beat sequence: **dot → pill → text**.

```css
/* ── Pill-from-dot entrance ── */
.motion-pill {
  display: inline-flex;
  align-items: center;
  overflow: hidden;
  opacity: 0;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  transform: scale(0);
  transition:
    transform 400ms var(--ease-out),
    opacity 200ms var(--ease-out),
    width 400ms var(--ease-out) 200ms,
    border-radius 400ms var(--ease-out) 200ms;
}
.motion-pill.visible {
  opacity: 1;
  transform: scale(1);
  width: var(--pill-width, 200px); /* set per-element or measure with JS */
  border-radius: 999px;
}
.motion-pill > span {
  opacity: 0;
  white-space: nowrap;
  transition: opacity 250ms var(--ease-out) 450ms; /* text fades in after pill expands */
}
.motion-pill.visible > span {
  opacity: 1;
}
```

### CSS Implementation

```css
/* ── Motion tokens ── */
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-subtle: cubic-bezier(0.4, 0, 0.2, 1);
  --dur-fast: 150ms;
  --dur-normal: 400ms;
  --dur-entrance: 600ms;
  --dur-stagger: 100ms;
}

/* ── Staggered entrance ── */
.motion-enter {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity var(--dur-entrance) var(--ease-out),
              transform var(--dur-entrance) var(--ease-out);
}
.motion-enter.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Cascade stagger — apply to children */
.motion-enter-stagger > .motion-enter:nth-child(1) { transition-delay: 0ms; }
.motion-enter-stagger > .motion-enter:nth-child(2) { transition-delay: 100ms; }
.motion-enter-stagger > .motion-enter:nth-child(3) { transition-delay: 200ms; }
.motion-enter-stagger > .motion-enter:nth-child(4) { transition-delay: 300ms; }
.motion-enter-stagger > .motion-enter:nth-child(5) { transition-delay: 400ms; }

/* Smaller slide for labels and secondary text */
.motion-enter-sm {
  opacity: 0;
  transform: translateY(12px);
  transition: opacity var(--dur-normal) var(--ease-out),
              transform var(--dur-normal) var(--ease-out);
}
.motion-enter-sm.visible {
  opacity: 1;
  transform: translateY(0);
}
```

## Particle Constellation

The signature decorative element: ink-colored circles that bloom outward from
a focal point, then drift ambientally.

### Behavior

- **Entrance:** Each dot scales from `0` to its final size with a random delay
  (200-600ms after content settles), origin is center-right of the hero.
- **Ambient:** Dots drift on individual sine-like paths, 6-14s period per dot,
  desynchronized. Movement range: 10-30px. Scale oscillation: 0.95-1.05.
- **Exit:** Dots scale back to 0 or drift offscreen, 400ms.
- **Count:** 15-25 dots per constellation. More looks busy; fewer looks sparse.
- **Sizes:** 4px, 8px, 12px, 16px, 24px (5 tiers). Smaller dots outnumber
  larger ones ~3:1.

### CSS Implementation

```css
.constellation {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.constellation-dot {
  position: absolute;
  border-radius: 50%;
  background: var(--ink);
  opacity: 0;
  transform: scale(0);
  transition: opacity var(--dur-normal) var(--ease-out),
              transform var(--dur-normal) var(--ease-out);
}
.constellation-dot.visible {
  opacity: 1;
  transform: scale(1);
}

/* Size tiers */
.dot-xs { width: 4px; height: 4px; }
.dot-sm { width: 8px; height: 8px; }
.dot-md { width: 12px; height: 12px; }
.dot-lg { width: 16px; height: 16px; }
.dot-xl { width: 24px; height: 24px; }

/* Ambient drift — each dot gets one */
@keyframes drift-a {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(12px, -18px) scale(1.03); }
  66% { transform: translate(-8px, 10px) scale(0.97); }
}
@keyframes drift-b {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(-15px, -10px) scale(0.96); }
  75% { transform: translate(10px, 20px) scale(1.04); }
}
@keyframes drift-c {
  0%, 100% { transform: translate(0, 0) scale(1); }
  40% { transform: translate(20px, 8px) scale(1.02); }
  80% { transform: translate(-12px, -14px) scale(0.98); }
}
```

### JS — Minimal Constellation Generator

```js
function createConstellation(container, {
  count = 20,
  originX = 0.65,  // 65% from left (right-biased, matching Scene.mp4)
  originY = 0.4,   // 40% from top
  spread = 300,    // max px from origin
} = {}) {
  const sizes = ['dot-xs','dot-xs','dot-xs','dot-sm','dot-sm','dot-sm',
                 'dot-md','dot-md','dot-lg','dot-xl'];
  const drifts = ['drift-a','drift-b','drift-c'];
  const rect = container.getBoundingClientRect();
  const cx = rect.width * originX;
  const cy = rect.height * originY;

  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div');
    dot.className = `constellation-dot ${sizes[i % sizes.length]}`;

    // Scatter from origin with bias toward top-right (matching Scene.mp4 diagonal)
    const angle = (Math.random() * Math.PI * 0.8) - Math.PI * 0.15; // -15° to +130°
    const dist = Math.random() * spread;
    const x = cx + Math.cos(angle) * dist;
    const y = cy - Math.sin(angle) * dist;
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;

    // Desynchronized ambient drift
    const drift = drifts[i % drifts.length];
    const duration = 6 + Math.random() * 8; // 6-14s
    const delay = Math.random() * -10;       // negative = already mid-loop
    dot.style.animation = `${drift} ${duration}s var(--ease-subtle) ${delay}s infinite`;

    // Staggered entrance
    dot.style.transitionDelay = `${300 + Math.random() * 400}ms`;

    container.appendChild(dot);

    // Trigger entrance after paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => dot.classList.add('visible'));
    });
  }
}
```

## Page Transition Pattern

From Scene.mp4's loop structure — content enters, holds, exits to clean slate:

| Phase | Duration | What happens |
|-------|----------|-------------|
| Enter | 0-600ms | Staggered cascade: label → heading → CTA → particles |
| Hold | 600ms-3.5s | Static content, ambient particle drift |
| Exit | 3.5s-4.5s | Content slides up + fades out, particles shrink to 0 |
| Rest | 4.5s-5s | Clean warm-white slate before next scene |

For the web app, only **Enter** and **Hold** apply (pages don't auto-exit).
Exit choreography is for transition animations between routes if/when added.

## Interaction Motion

Extends the entrance system for user-triggered state changes:

| Interaction | Motion | Duration | Easing |
|-------------|--------|----------|--------|
| Card hover | translateY(-2px) + shadow deepen | 150ms | `--ease-subtle` |
| Button press | scale(0.97) | 100ms | `--ease-out` |
| Button hover | translateY(-1px) + shadow | 150ms | `--ease-subtle` |
| Tab switch | fade crossfade, no slide | 200ms | `--ease-subtle` |
| Toast enter | translateY(16px) + fade in | 300ms | `--ease-out` |
| Toast exit | translateY(-8px) + fade out | 200ms | `--ease-subtle` |
| Modal enter | scale(0.96) + fade → scale(1) | 250ms | `--ease-out` |
| Dropdown | scaleY(0.95) + fade → scaleY(1) | 200ms | `--ease-out` |

## Reduced Motion

All motion respects `prefers-reduced-motion: reduce`:

```css
@media (prefers-reduced-motion: reduce) {
  .motion-enter,
  .motion-enter-sm,
  .constellation-dot {
    opacity: 1;
    transform: none;
    transition: none;
    animation: none;
  }
  .constellation { display: none; }
}
```

Particles are purely decorative — hiding them entirely is correct. Content
entrances snap to final state with no transition.

## Where to Use What

| Element | Motion class | Notes |
|---------|-------------|-------|
| Hero section | `motion-enter-stagger` + constellation | Full choreography |
| Section headings | `motion-enter` via IntersectionObserver | Scroll-reveal |
| Cards | `motion-enter` with stagger | Cascade left-to-right or top-to-bottom |
| Stats/numbers | `motion-enter-sm` | Subtle, secondary |
| Deal timeline steps | `motion-enter` + stagger + `.lit` state | Already in mockup |
| Background particles | `constellation` | Hero only — one per page max |
| Buttons | Hover/press from interaction table | CSS only, no JS |

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-04 | Particle constellation as signature ornament | Matches Scene.mp4 Jitter reference; ink-only keeps it on-brand |
| 2026-09-04 | Stagger at 100ms intervals | Scene.mp4 pacing — fast enough to feel unified, slow enough to read hierarchy |
| 2026-09-04 | Spring-like ease `(0.16, 1, 0.3, 1)` as primary | Matches the snappy-then-gentle feel in the reference |
| 2026-09-04 | One constellation per page max | Decoration budget — more than one competes with content |
