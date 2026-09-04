# Design System — "Cabinet of Curiosities"

Derived from `design_tests/Create_a_video_of_a_butterfly.mp4`. A mixed-media
collage aesthetic that merges natural history, cartography, and circuitry into
a layered paper world.

## Aesthetic Direction

- **Direction:** Scientific Collage — the look of a naturalist's desk where
  antique maps, botanical plates, circuit boards, and graph paper overlap.
  Every surface is paper; every subject is a composite of found materials.
- **Mood:** A Wunderkammer (cabinet of curiosities) brought to life. Scholarly
  warmth, analog tactility, quiet wonder.
- **Decoration level:** Rich but earned — collage textures carry visual weight;
  the chrome/ground is plain paper. Complexity lives in the subject, not the
  frame.
- **Reference:** Alexander McQueen prints (nature × technology collage),
  vintage Audubon plates, Dieter Rams grid discipline as a grounding foil.

## Color Palette

| Token | Hex | Role |
|-------|-----|------|
| `--ground` | `#F0ECE2` | Warm parchment/cream — the paper itself |
| `--grid` | `#E0DBD0` | Graph paper grid lines, hairlines |
| `--ink` | `#1A1815` | Near-black text, body outlines, primary type |
| `--teal` | `#2A9D8F` | Circuit traces, accent butterflies, tech veins |
| `--botanical` | `#4A7C5B` | Leaf greens from botanical plates |
| `--map-parch` | `#D4C9A8` | Cartography parchment, wing fill |
| `--map-line` | `#B35640` | Map boundary red/orange lines |
| `--rose` | `#C47B84` | Petal pink, dissolution fragments |
| `--graph-blue` | `#3B82C4` | Graph paper axis/line blue |
| `--amber-spot` | `#D68830` | Warm amber accent (wing eyespots) |
| `--wing-dark` | `#2C2A26` | Dark wing edges, near-ink with warmth |

### Color usage rules

1. **Ground is always paper.** `--ground` or lighter, never saturated.
2. **Saturation lives in the subject only.** The collage creature/object gets
   the full palette; surrounding chrome uses only `--ground`, `--grid`,
   `--ink`.
3. **Teal is the technology voice.** Circuit traces, data accents, interactive
   highlights — never decorative fill.
4. **Rose appears only in motion/transition.** Petals, dissolution fragments,
   trailing elements. Not in static layouts.

## Typography

- **Display:** High-contrast Didone serif (Didot, Bodoni, or Playfair Display).
  Massive scale, centered, ink on cream. From the video's "Dienortife" title
  card — classic, authoritative, museum-label energy.
- **Scale:** display `clamp(3rem, 8vw, 6rem)`, weight 400-700 (serifs carry
  weight through contrast, not boldness).
- **Body:** A clean humanist sans (the serif is reserved for display only).
- **Data:** Tabular-nums, monospace-aligned.

## Texture System

Five paper layers observed in the video, usable as backgrounds or overlays:

| Texture | Description | Use |
|---------|-------------|-----|
| Grid paper | Fine ruled grid on warm cream | Default ground, hero backgrounds |
| Botanical plate | Aged cream with hand-drawn flora, foxed edges | Section dividers, illustration panels |
| Cartography | Antique map with colored boundary lines | Feature imagery, subject fills |
| Music manuscript | Staff lines, hand-written notes, aged paper | Alternate section backgrounds |
| Circuit trace | Teal traces on dark or transparent | Overlay accents, technology signals |

### Torn-edge borders

The video uses torn paper edges rather than clean cuts. In CSS:
physically irregular mask-image or clip-path with a rough SVG edge, or a
PNG border-image with transparent torn-paper alpha.

## Composition

- **Center-axis symmetry** is the default for hero/primary subjects.
  The butterfly is always centered; asymmetry comes from the background
  collage layers, not the subject.
- **Layered depth:** 2-3 paper layers visible at once, offset and rotated
  slightly (1-3deg), with torn edges showing layer boundaries.
- **Grid as discipline:** The graph paper grid is the underlying structure.
  Content aligns to it; collage elements break it deliberately.
- **Single subject focus:** One primary collage object per viewport. Supporting
  elements are small (flowers, gears, fragments) and orbit the subject.

## Iconography

Small decorative elements from the video, usable as scatter ornaments:

- Pressed flowers (pink, white, yellow — botanical plate style)
- Clockwork gears (brass/amber, small)
- Wireframe/line-art butterflies (ink outline only, no fill)
- Seeds and leaf fragments
- Four-point star sparkle (bottom-right in video — a subtle brand mark)
