# Clipline conventions (read before building)

Clipline is a light-only design system: pure white ground, **crimson** primary
(`--primary`, oklch(0.464 0.169 26.9)) as the identity color, **amber**
(`--amber`) as the second voice for ratings/badges/attention. Typeface is
**Bricolage Grotesque** only (loaded by `styles.css`; never add another font).

## Setup

No provider is required. Components style themselves via Tailwind utility
classes resolved by `styles.css` — make sure it is loaded. Font family comes
from `--font-sans` (defined in `styles.css`).

## Styling idiom: Tailwind v4 utilities over CSS variables

Style your own layout glue with Tailwind classes backed by these tokens
(all defined in `styles.css`; use the class forms):

| Purpose | Classes |
|---|---|
| Ground / text | `bg-background`, `text-foreground`, `text-muted-foreground` |
| Brand | `bg-primary text-primary-foreground` (white text on crimson — always), `text-primary` (prices, emphasis) |
| Second voice | `bg-amber text-amber-foreground` (ink text on amber — badges, ratings, attention) |
| Wells / chips | `bg-secondary`, `border` (hairlines) |
| States | `text-destructive`, `bg-ok`, `text-warn` |
| Radius | `rounded-lg` (inputs/buttons), `rounded-xl` (cards), `rounded-full` (pills/chips) |

Rules that always hold: white text on crimson fills; ink text on amber fills;
prices are `font-extrabold tabular-nums text-primary`; hairline borders do
elevation (no decorative shadows); NEVER use gradients, gradient text,
glassmorphism, `border-l-4` accent stripes, or dark backgrounds on workflow
screens.

## Component API

- `Button`: `variant` = `default` (crimson, THE advancing action — one per view) | `outline` (secondary) | `secondary` | `ghost` (chrome); `size` = `sm|default|lg|icon`. Confirm-class actions (cancel/dispute/refund): `variant="outline" className="text-destructive border-destructive/40"`.
- `Badge`: `variant="secondary"` for neutral chips (niches, statuses); `className="bg-amber text-amber-foreground hover:bg-amber"` for Verified/attention.
- `Card` + `CardHeader/CardTitle/CardDescription/CardContent/CardFooter`: the list-row and panel unit. Never nest cards.
- `Input`/`Textarea` always pair with `Label htmlFor`. Search fields go pill: `style/className` with `rounded-full h-10 px-4`.
- `Select` (+`SelectTrigger/SelectValue/SelectContent/SelectGroup/SelectLabel/SelectItem`): compose the full set; `SelectGroup` etc. never render alone.
- `Separator`: `orientation="horizontal" | "vertical"`.

## Where the truth lives

`styles.css` (tokens + all utilities), each component's `.d.ts` (API) and
`.prompt.md` (usage). Read those before inventing.

## Idiomatic snippet

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge } from 'influencer-marketplace';

<Card className="max-w-md">
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle>Dedicated review video</CardTitle>
      <Badge className="bg-amber text-amber-foreground hover:bg-amber">Verified</Badge>
    </div>
    <CardDescription>14-day turnaround · 2 revisions included</CardDescription>
  </CardHeader>
  <CardContent className="text-sm leading-relaxed">
    A full 3–5 minute review of your product, b-roll included.
  </CardContent>
  <CardFooter className="flex items-center justify-between">
    <span className="text-2xl font-extrabold tabular-nums text-primary">$450</span>
    <Button>Book this</Button>
  </CardFooter>
</Card>
```
