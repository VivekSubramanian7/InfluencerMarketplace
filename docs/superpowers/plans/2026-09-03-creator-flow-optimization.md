# Creator Flow Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce creator workflow friction by consolidating dashboard tabs, unifying onboarding/dashboard forms, streamlining inbox-to-deal flow, improving deal detail density, adding smarter campaign application defaults, and fixing notification mobile UX.

**Architecture:** Extract 3 shared form components from dashboard sub-pages, add `mode` prop for wizard/settings variants. Dashboard becomes a single tabbed page. Inbox flow gets offer badges + auto-scroll + direct deal navigation. Deal page gets collapsible timeline + review modal + promoted action card. Campaign application gets contextual placeholders + creator stats card. Notification list gets mobile mark-as-read + quick-action buttons.

**Tech Stack:** Next.js 15 (App Router, Server Components, Server Actions), Tailwind CSS, Supabase (PostgREST client)

**Spec:** `docs/superpowers/specs/2026-09-03-creator-flow-optimization-design.md`

## Global Constraints

- No database schema changes. No new migrations.
- No new npm dependencies.
- All server actions keep their existing signatures — only redirect paths change.
- Shared form components receive data as props — no Supabase client calls inside them.
- Follow existing patterns: `SiteNav` at top, `requireRole`/`requireUser` for auth, `redirect()` for post-action navigation.
- Client components use `"use client"` directive. Server components are the default.

---

### Task 1: Extract Profile Form Component

**Files:**
- Create: `components/creator/profile-form.tsx`
- Modify: `app/dashboard/profile/actions.ts` — update redirect paths
- Test: manual — dev server, save profile from dashboard, verify redirect to `/dashboard?tab=profile&saved=1`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `ProfileForm` component with props `{ profile: { handle, bio, niches, country, languages, status } | null; action: (formData: FormData) => void; statusAction?: (formData: FormData) => void; mode: "wizard" | "settings"; error?: string; saved?: string }`

- [ ] **Step 1: Create the shared ProfileForm component**

Extract the form JSX from `app/dashboard/profile/page.tsx` lines 54-87 into a new component. The component receives profile data, server action, and mode as props.

`components/creator/profile-form.tsx`:
```tsx
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface ProfileFormProps {
  profile: {
    handle: string;
    bio: string | null;
    niches: string[] | null;
    country: string | null;
    languages: string[] | null;
    status: string;
  } | null;
  action: (formData: FormData) => void;
  statusAction?: (formData: FormData) => void;
  mode: "wizard" | "settings";
  error?: string;
  saved?: string;
}

export function ProfileForm({ profile, action, statusAction, mode, error, saved }: ProfileFormProps) {
  const p = profile;
  return (
    <>
      {mode === "settings" && p && (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          Status: <Badge variant="secondary">{p.status}</Badge>
          {p.status === "live" && (
            <>
              , public at{" "}
              <a className="text-primary underline" href={`/c/${p.handle}`}>
                /c/{p.handle}
              </a>
            </>
          )}
        </p>
      )}
      {mode === "wizard" && (
        <p className="mt-2 text-sm text-muted-foreground">
          Your handle becomes your public storefront URL. Brands will find you at /c/your-handle.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p className="mt-4 rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
          Saved.
        </p>
      )}

      <form action={action} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="handle">{mode === "wizard" ? "Handle" : "Handle (your public URL: /c/…)"}</Label>
          <Input
            id="handle"
            name="handle"
            defaultValue={p?.handle ?? ""}
            required
            placeholder={mode === "wizard" ? "e.g. caseyclips" : undefined}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            name="bio"
            defaultValue={p?.bio ?? ""}
            rows={4}
            placeholder={mode === "wizard" ? "What you make and who it's for." : undefined}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="niches">Niches (comma-separated, up to 8)</Label>
          <Input
            id="niches"
            name="niches"
            defaultValue={(p?.niches ?? []).join(", ")}
            placeholder={mode === "wizard" ? "food, lifestyle" : undefined}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="country">Country</Label>
          <Input id="country" name="country" defaultValue={p?.country ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="languages">Languages (comma-separated, up to 5)</Label>
          <Input id="languages" name="languages" defaultValue={(p?.languages ?? []).join(", ")} />
        </div>
        {mode === "wizard" ? (
          <SubmitButton className="mt-2 self-start" pendingLabel="Saving…">
            Save and continue
          </SubmitButton>
        ) : (
          <Button type="submit" className="mt-2">
            Save profile
          </Button>
        )}
      </form>

      {mode === "settings" && p && statusAction && (
        <form action={statusAction} className="mt-6">
          <input type="hidden" name="status" value={p.status === "live" ? "draft" : "live"} />
          <Button type="submit" variant="outline" className="w-full">
            {p.status === "live" ? "Unpublish (back to draft)" : "Publish storefront"}
          </Button>
        </form>
      )}
    </>
  );
}
```

- [ ] **Step 2: Update profile action redirects**

In `app/dashboard/profile/actions.ts`, change all `/dashboard/profile` redirects to `/dashboard?tab=profile`:

- Line 15: `redirect("/dashboard?tab=profile&error=" + ...)`
- Line 22: `redirect("/dashboard?tab=profile&saved=1")`
- Line 37: `redirect("/dashboard?tab=profile&error=" + ...)`
- Line 41: `redirect("/dashboard?tab=profile&saved=1")`

```ts
// saveCreatorProfile — error path
redirect("/dashboard?tab=profile&error=" + encodeURIComponent(result.error));
// saveCreatorProfile — success path
redirect("/dashboard?tab=profile&saved=1");
// setProfileStatus — error path
redirect("/dashboard?tab=profile&error=" + encodeURIComponent(error?.message ?? "Create your profile first"));
// setProfileStatus — success path
redirect("/dashboard?tab=profile&saved=1");
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | head -30`
Expected: Clean build, no import errors.

- [ ] **Step 4: Commit**

```bash
git add components/creator/profile-form.tsx app/dashboard/profile/actions.ts
git commit -m "refactor: extract ProfileForm component, update profile action redirects"
```

---

### Task 2: Extract Offerings Panel Component

**Files:**
- Create: `components/creator/offerings-panel.tsx`
- Modify: `app/dashboard/offerings/actions.ts` — update redirect paths
- Test: manual — dev server, add/toggle/delete offering, verify redirects

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `OfferingsPanel` component with props `{ offerings: Offering[]; saveAction: (fd: FormData) => void; toggleAction: (fd: FormData) => void; deleteAction: (fd: FormData) => void; mode: "wizard" | "settings"; continueHref?: string; error?: string; saved?: string }`

- [ ] **Step 1: Create the shared OfferingsPanel component**

Extract from `app/dashboard/offerings/page.tsx` and `app/onboarding/offerings/page.tsx`. The component renders the offering list + add form, adapting labels/layout by mode.

`components/creator/offerings-panel.tsx`:
```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const TYPE_LABELS: Record<string, string> = {
  dedicated_video: "Dedicated video",
  integration: "Integration (60-90s)",
  short_form_post: "Short-form post",
  ugc_video: "UGC video (no posting)",
};

interface Offering {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  price_cents: number;
  turnaround_days?: number;
  revision_limit?: number;
  active?: boolean;
}

interface OfferingsPanelProps {
  offerings: Offering[];
  saveAction: (formData: FormData) => void;
  toggleAction?: (formData: FormData) => void;
  deleteAction?: (formData: FormData) => void;
  mode: "wizard" | "settings";
  continueHref?: string;
  error?: string;
  saved?: string;
}

export function OfferingsPanel({
  offerings,
  saveAction,
  toggleAction,
  deleteAction,
  mode,
  continueHref,
  error,
  saved,
}: OfferingsPanelProps) {
  return (
    <>
      {mode === "wizard" && (
        <p className="mt-2 text-sm text-muted-foreground">
          Productize what brands can book: a clear title, a set price, a turnaround.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p className="mt-4 rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
          {mode === "wizard" ? "Offering added! Add another or continue." : "Saved."}
        </p>
      )}

      {mode === "settings" ? (
        <ul className="mt-6 mb-10 flex flex-col gap-3">
          {offerings.map((o) => (
            <li key={o.id} className="rounded-xl border p-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-bold">{o.title}</span>
                <span className="font-extrabold tabular-nums text-primary">
                  ${(o.price_cents / 100).toFixed(2)}
                </span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                {TYPE_LABELS[o.type] ?? o.type} · {o.turnaround_days}d turnaround ·{" "}
                {o.revision_limit} revisions ·{" "}
                <Badge variant="secondary">{o.active ? "active" : "hidden"}</Badge>
              </p>
              <div className="mt-3 flex gap-2">
                {toggleAction && (
                  <form action={toggleAction}>
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="active" value={o.active ? "false" : "true"} />
                    <Button type="submit" variant="outline" size="sm">
                      {o.active ? "Hide" : "Activate"}
                    </Button>
                  </form>
                )}
                {deleteAction && (
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={o.id} />
                    <ConfirmSubmitButton
                      label="Delete"
                      confirmLabel="Delete for good"
                      message="This removes the offering permanently."
                    />
                  </form>
                )}
              </div>
            </li>
          ))}
          {offerings.length === 0 && (
            <li className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No offerings yet. Add your first below.
            </li>
          )}
        </ul>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {offerings.map((o) => (
            <li key={o.id} className="flex items-baseline justify-between gap-4 rounded-xl border p-4">
              <span className="min-w-0 truncate">
                <span className="font-bold">{o.title}</span>{" "}
                <span className="text-sm text-muted-foreground">{TYPE_LABELS[o.type] ?? o.type}</span>
              </span>
              <span className="shrink-0 font-extrabold tabular-nums text-primary">
                ${(o.price_cents / 100).toFixed(2)}
              </span>
            </li>
          ))}
          {offerings.length === 0 && (
            <li className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No offerings yet. Add your first below.
            </li>
          )}
        </ul>
      )}

      <section className={mode === "wizard" ? "mt-6 rounded-xl border p-5" : "mt-0"}>
        <h2 className="font-bold">{mode === "settings" ? "Add an offering" : "Add an offering"}</h2>
        <form action={saveAction} className="mt-3 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              name="type"
              className="h-10 rounded-lg border bg-background px-3 text-sm"
              defaultValue="dedicated_video"
            >
              {Object.entries(TYPE_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              required
              placeholder={mode === "wizard" ? "Honest product review video" : undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>
          {mode === "wizard" ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="price">Price (USD)</Label>
                <Input id="price" name="price" inputMode="decimal" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="turnaround_days">Turnaround (days)</Label>
                <Input id="turnaround_days" name="turnaround_days" type="number" defaultValue={14} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="revision_limit">Revisions</Label>
                <Input id="revision_limit" name="revision_limit" type="number" defaultValue={1} />
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="price">Price (USD)</Label>
                <Input id="price" name="price" inputMode="decimal" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="turnaround_days">Turnaround (days)</Label>
                <Input id="turnaround_days" name="turnaround_days" type="number" defaultValue={14} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="revision_limit">Included revisions</Label>
                <Input id="revision_limit" name="revision_limit" type="number" defaultValue={1} />
              </div>
            </>
          )}
          {mode === "wizard" ? (
            <SubmitButton variant="outline" className="self-start" pendingLabel="Adding…">
              Add offering
            </SubmitButton>
          ) : (
            <Button type="submit" className="mt-2">
              Save offering
            </Button>
          )}
        </form>
      </section>

      {mode === "wizard" && continueHref && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
          <p className="text-sm text-muted-foreground">
            {offerings.length > 0
              ? `${offerings.length} ${offerings.length === 1 ? "offering" : "offerings"} added`
              : "Nothing added yet, you can do this later"}
          </p>
          <Button asChild>
            <Link href={continueHref}>Continue → Show your best work</Link>
          </Button>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Update offerings action redirects**

In `app/dashboard/offerings/actions.ts`, change all `/dashboard/offerings` to `/dashboard?tab=offerings` and `/dashboard/profile` to `/dashboard?tab=profile`:

```ts
// saveOffering — profile redirect
if (!handle) redirect("/dashboard?tab=profile&error=" + encodeURIComponent("Create your profile before adding offerings"));
// saveOffering — description error
if (!descriptionResult.ok) redirect("/dashboard?tab=offerings&error=" + encodeURIComponent("Description is too long (max 2000 characters)"));
// saveOffering — validation error
redirect("/dashboard?tab=offerings&error=" + encodeURIComponent("Check the form: title (≤80), price $1–$1,000,000, turnaround 1–90 days, revisions 0–5"));
// saveOffering — db error
if (error) redirect("/dashboard?tab=offerings&error=" + encodeURIComponent(error.message));
// saveOffering — success
redirect("/dashboard?tab=offerings&saved=1");
// toggleOffering — db error
if (error) redirect("/dashboard?tab=offerings&error=" + encodeURIComponent(error.message));
// toggleOffering — success
redirect("/dashboard?tab=offerings&saved=1");
// deleteOffering — db error
if (error) redirect("/dashboard?tab=offerings&error=" + encodeURIComponent(error.message));
// deleteOffering — success
redirect("/dashboard?tab=offerings&saved=1");
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | head -30`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add components/creator/offerings-panel.tsx app/dashboard/offerings/actions.ts
git commit -m "refactor: extract OfferingsPanel component, update offerings action redirects"
```

---

### Task 3: Extract Portfolio Panel Component

**Files:**
- Create: `components/creator/portfolio-panel.tsx`
- Modify: `app/dashboard/portfolio/actions.ts` — update redirect paths
- Test: manual — dev server, add/delete portfolio item, verify redirects

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `PortfolioPanel` component with props `{ items: PortfolioItem[]; addAction: (fd: FormData) => void; deleteAction: (fd: FormData) => void; mode: "wizard" | "settings"; continueHref?: string; handle?: string; gradientSeed: string; error?: string; saved?: string }`

- [ ] **Step 1: Create the shared PortfolioPanel component**

Extract from `app/dashboard/portfolio/page.tsx` and `app/onboarding/highlights/page.tsx`. Settings mode shows the rich card grid; wizard mode shows the compact list.

`components/creator/portfolio-panel.tsx`:
```tsx
import Link from "next/link";
import { creatorGradient } from "@/lib/identity/gradient";
import { detectPlatform } from "@/lib/portfolio/platform";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface PortfolioItem {
  id: string;
  media_url: string;
  caption: string | null;
}

interface PortfolioPanelProps {
  items: PortfolioItem[];
  addAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
  mode: "wizard" | "settings";
  continueHref?: string;
  handle?: string;
  gradientSeed: string;
  error?: string;
  saved?: string;
}

export function PortfolioPanel({
  items,
  addAction,
  deleteAction,
  mode,
  continueHref,
  handle,
  gradientSeed,
  error,
  saved,
}: PortfolioPanelProps) {
  return (
    <>
      {mode === "settings" && (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className="mt-1 text-muted-foreground">
            Link your best work from YouTube, TikTok, or Instagram. Brands see
            these on your storefront.
          </p>
          {handle && items.length > 0 && (
            <a
              href={`/c/${handle}`}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              See it on your storefront →
            </a>
          )}
        </div>
      )}
      {mode === "wizard" && (
        <p className="mt-2 text-sm text-muted-foreground">
          Link the videos you&apos;re proudest of. They show as your recent work on the storefront.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p className="mt-4 rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
          {mode === "wizard" ? "Highlight added! Add another or continue." : "Saved."}
        </p>
      )}

      {mode === "settings" && (
        <section className="mt-8 rounded-2xl bg-card p-6 shadow-card">
          <h2 className="font-bold">Add a video</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste any video link and we detect the platform automatically.
          </p>
          <form action={addAction} className="mt-4 flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="media_url">Video link</Label>
              <Input id="media_url" name="media_url" type="url" required placeholder="Paste your video link" />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="caption">Caption (optional)</Label>
              <Input id="caption" name="caption" placeholder="What this video shows off" />
            </div>
            <Button type="submit" className="shrink-0">Add to portfolio</Button>
          </form>
        </section>
      )}

      {mode === "settings" ? (
        items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">No videos yet.</p>
            <p className="mt-1">
              Your portfolio is the first thing brands look at. Add your three
              strongest videos to start.
            </p>
          </div>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {items.map((item, i) => {
              const gradient = creatorGradient(`${gradientSeed}-${i}`);
              const platform = detectPlatform(item.media_url);
              let host = item.media_url;
              try { host = new URL(item.media_url).hostname.replace(/^www\./, ""); } catch {}
              return (
                <li key={item.id} className="overflow-hidden rounded-2xl bg-card shadow-card transition-shadow hover:shadow-card-hover">
                  <a href={item.media_url} target="_blank" rel="noopener noreferrer" className="block">
                    <div aria-hidden className="relative h-24" style={{ background: gradient.css, opacity: 0.85 }} />
                    <span className="-mt-4 ml-4 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold shadow-card" style={{ color: gradient.deep }}>
                      {platform.label}
                    </span>
                    <div className="px-4 pt-2">
                      <p className="truncate font-semibold">{item.caption ?? "Watch"}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{host}</p>
                    </div>
                  </a>
                  <div className="flex items-center justify-between px-4 pb-4 pt-3">
                    <a href={item.media_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-muted-foreground hover:text-foreground">Open ↗</a>
                    <form action={deleteAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <Button type="submit" variant="outline" size="sm" className="border-destructive/40 text-destructive">Remove</Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <>
          <ul className="mt-6 flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 rounded-xl border p-4">
                <span className="min-w-0">
                  <Badge variant="secondary">{detectPlatform(item.media_url).label}</Badge>{" "}
                  <span className="break-all text-sm">{item.caption || item.media_url}</span>
                </span>
                <form action={deleteAction} className="shrink-0">
                  <input type="hidden" name="id" value={item.id} />
                  <Button type="submit" variant="outline" size="sm">Remove</Button>
                </form>
              </li>
            ))}
            {items.length === 0 && (
              <li className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No highlights yet. Paste your first video link below.
              </li>
            )}
          </ul>

          <section className="mt-6 rounded-xl border p-5">
            <h2 className="font-bold">Add a highlight</h2>
            <form action={addAction} className="mt-3 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="media_url">Video link</Label>
                <Input id="media_url" name="media_url" required placeholder="https://youtube.com/watch?v=…" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="caption">Caption (optional)</Label>
                <Input id="caption" name="caption" placeholder="Taste-testing every flavor of…" />
              </div>
              <SubmitButton variant="outline" className="self-start" pendingLabel="Adding…">
                Add highlight
              </SubmitButton>
            </form>
          </section>

          {continueHref && (
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
              <p className="text-sm text-muted-foreground">
                {items.length > 0
                  ? `${items.length} ${items.length === 1 ? "highlight" : "highlights"} added`
                  : "Nothing added yet, you can do this later"}
              </p>
              <Button asChild>
                <Link href={continueHref}>Continue → Go live</Link>
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
```

- [ ] **Step 2: Update portfolio action redirects**

In `app/dashboard/portfolio/actions.ts`, change all `/dashboard/portfolio` to `/dashboard?tab=portfolio`:

```ts
// addPortfolioItem — url error
if (!mediaUrl) redirect("/dashboard?tab=portfolio&error=" + encodeURIComponent("Enter a valid http(s) link to your video"));
// addPortfolioItem — caption error
if (!captionResult.ok) redirect("/dashboard?tab=portfolio&error=" + encodeURIComponent("Caption is too long (max 200 characters)"));
// addPortfolioItem — db error
if (error) redirect("/dashboard?tab=portfolio&error=" + encodeURIComponent(error.message));
// addPortfolioItem — success
redirect("/dashboard?tab=portfolio&saved=1");
// deletePortfolioItem — db error
if (error) redirect("/dashboard?tab=portfolio&error=" + encodeURIComponent(error.message));
// deletePortfolioItem — success
redirect("/dashboard?tab=portfolio&saved=1");
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | head -30`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add components/creator/portfolio-panel.tsx app/dashboard/portfolio/actions.ts
git commit -m "refactor: extract PortfolioPanel component, update portfolio action redirects"
```

---

### Task 4: Dashboard Tab Consolidation + Onboarding Unification

**Files:**
- Modify: `app/dashboard/page.tsx` — add tab bar, render shared components per tab
- Delete: `app/dashboard/profile/page.tsx`
- Delete: `app/dashboard/offerings/page.tsx`
- Delete: `app/dashboard/portfolio/page.tsx`
- Modify: `app/onboarding/profile/page.tsx` — slim to wrapper + shared component
- Modify: `app/onboarding/offerings/page.tsx` — slim to wrapper + shared component
- Modify: `app/onboarding/highlights/page.tsx` — slim to wrapper + shared component
- Modify: `components/mobile-nav.tsx` — update "New" button href
- Modify: `app/campaigns/[id]/actions.ts` — update redirect to `/dashboard?tab=profile`
- Test: manual — dev server, navigate all 4 tabs, test onboarding wizard, test mobile nav

**Interfaces:**
- Consumes: `ProfileForm` from Task 1, `OfferingsPanel` from Task 2, `PortfolioPanel` from Task 3
- Produces: single `/dashboard` route with `?tab=` param; onboarding pages using shared components

- [ ] **Step 1: Rewrite the dashboard page with tabs**

Replace `app/dashboard/page.tsx` content. The page now handles all 4 tabs — Overview (default), Profile, Offerings, Portfolio. Data fetching for each tab is conditional on the active tab to avoid unnecessary queries.

`app/dashboard/page.tsx`:
```tsx
import Link from "next/link";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { creatorGradient } from "@/lib/identity/gradient";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SendIcon } from "@/components/ui/icons";
import { ProfileForm } from "@/components/creator/profile-form";
import { OfferingsPanel } from "@/components/creator/offerings-panel";
import { PortfolioPanel } from "@/components/creator/portfolio-panel";
import { saveCreatorProfile, setProfileStatus } from "./profile/actions";
import { saveOffering, toggleOffering, deleteOffering } from "./offerings/actions";
import { addPortfolioItem, deletePortfolioItem } from "./portfolio/actions";

const ACTIVE_STATUSES = [
  "requested", "funded", "accepted", "in_production",
  "submitted", "revision_requested", "published",
];

const STATUS_LABELS: Record<string, string> = {
  requested: "Awaiting your response", funded: "Funded, respond",
  accepted: "Accepted", in_production: "In production",
  submitted: "Preview submitted", revision_requested: "Changes requested",
  published: "Awaiting brand approval", completed: "Completed",
  cancelled: "Cancelled", disputed: "Disputed",
};

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "profile", label: "Profile" },
  { value: "offerings", label: "Offerings" },
  { value: "portfolio", label: "Portfolio" },
] as const;

type Tab = (typeof TABS)[number]["value"];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string; saved?: string }>;
}) {
  const { user, role } = await requireRole("creator", "/dashboard");
  const { tab: rawTab, error, saved } = await searchParams;
  const activeTab: Tab = TABS.some((t) => t.value === rawTab) ? (rawTab as Tab) : "overview";
  const supabase = await createServerSupabase();

  // Always fetch profile + counts (needed for overview sidebar and tab badges)
  const [
    { data: profile },
    { count: offeringCount },
    { count: portfolioCount },
    { count: socialCount },
  ] = await Promise.all([
    supabase.from("creator_profiles").select("handle, bio, niches, country, languages, status").eq("user_id", user.id).maybeSingle(),
    supabase.from("offerings").select("id", { count: "exact", head: true }).eq("creator_id", user.id),
    supabase.from("portfolio_items").select("id", { count: "exact", head: true }).eq("creator_id", user.id),
    supabase.from("connected_accounts").select("id", { count: "exact", head: true }).eq("creator_id", user.id),
  ]);

  // Tab-specific data
  const deals = activeTab === "overview"
    ? (await supabase.from("deals").select("id, offering_title, price_cents, status, requested_at").eq("creator_id", user.id).order("requested_at", { ascending: false })).data
    : null;
  const myRatings = activeTab === "overview"
    ? (await supabase.from("public_creator_reviews").select("rating").eq("creator_id", user.id)).data
    : null;
  const offerings = activeTab === "offerings"
    ? (await supabase.from("offerings").select("id, type, title, description, price_cents, turnaround_days, revision_limit, active").eq("creator_id", user.id).order("created_at", { ascending: false })).data
    : null;
  const portfolioItems = activeTab === "portfolio"
    ? (await supabase.from("portfolio_items").select("id, media_url, caption").eq("creator_id", user.id).order("created_at", { ascending: false })).data
    : null;

  const gradient = profile ? creatorGradient(profile.handle) : null;

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Your studio</h1>
            <p className="mt-1 text-muted-foreground">
              {profile?.status === "live"
                ? "Your storefront is live and bookable."
                : "Finish setup to open for bookings."}
            </p>
          </div>
          {profile?.status === "live" && (
            <Button asChild className="px-5">
              <a href={`/c/${profile.handle}`}>View storefront</a>
            </Button>
          )}
        </div>

        <nav className="mt-6 flex gap-1 border-b" aria-label="Dashboard tabs">
          {TABS.map((t) => {
            const active = activeTab === t.value;
            return (
              <Link
                key={t.value}
                href={t.value === "overview" ? "/dashboard" : `/dashboard?tab=${t.value}`}
                className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        {activeTab === "overview" && (
          <OverviewTab
            profile={profile}
            deals={deals ?? []}
            myRatings={myRatings ?? []}
            offeringCount={offeringCount ?? 0}
            portfolioCount={portfolioCount ?? 0}
            socialCount={socialCount ?? 0}
            gradient={gradient}
          />
        )}

        {activeTab === "profile" && (
          <div className="mt-6 max-w-2xl">
            <h2 className="text-2xl font-extrabold tracking-tight">Your creator profile</h2>
            <ProfileForm
              profile={profile}
              action={saveCreatorProfile}
              statusAction={setProfileStatus}
              mode="settings"
              error={error}
              saved={saved}
            />
          </div>
        )}

        {activeTab === "offerings" && (
          <div className="mt-6 max-w-2xl">
            <h2 className="text-2xl font-extrabold tracking-tight">Your offerings</h2>
            <OfferingsPanel
              offerings={offerings ?? []}
              saveAction={saveOffering}
              toggleAction={toggleOffering}
              deleteAction={deleteOffering}
              mode="settings"
              error={error}
              saved={saved}
            />
          </div>
        )}

        {activeTab === "portfolio" && (
          <div className="mt-6 max-w-4xl">
            <h2 className="text-2xl font-extrabold tracking-tight">Your portfolio</h2>
            <PortfolioPanel
              items={portfolioItems ?? []}
              addAction={addPortfolioItem}
              deleteAction={deletePortfolioItem}
              mode="settings"
              handle={profile?.handle ?? undefined}
              gradientSeed={profile?.handle ?? user.id}
              error={error}
              saved={saved}
            />
          </div>
        )}
      </main>
    </>
  );
}

function OverviewTab({
  profile,
  deals,
  myRatings,
  offeringCount,
  portfolioCount,
  socialCount,
  gradient,
}: {
  profile: { handle: string; status: string } | null;
  deals: { id: string; offering_title: string; price_cents: number; status: string; requested_at: string }[];
  myRatings: { rating: number }[];
  offeringCount: number;
  portfolioCount: number;
  socialCount: number;
  gradient: { css: string; deep: string } | null;
}) {
  const allDeals = deals;
  const activeDeals = allDeals.filter((d) => ACTIVE_STATUSES.includes(d.status));
  const completedDeals = allDeals.filter((d) => d.status === "completed");
  const earnedCents = completedDeals.reduce((sum, d) => sum + d.price_cents, 0);
  const avgRating = myRatings.length > 0
    ? Math.round((myRatings.reduce((s, r) => s + r.rating, 0) / myRatings.length) * 10) / 10
    : null;
  const recentDeals = allDeals.slice(0, 4);

  const steps = [
    { done: !!profile, label: "Create your profile", href: "/onboarding/profile" },
    { done: socialCount > 0, label: "Add your social accounts", href: "/onboarding/socials" },
    { done: offeringCount > 0, label: "Add at least one offering", href: "/onboarding/offerings" },
    { done: portfolioCount > 0, label: "Link portfolio videos", href: "/onboarding/highlights" },
    { done: profile?.status === "live", label: "Publish your storefront", href: "/onboarding/publish" },
  ];
  const openSteps = steps.filter((s) => !s.done);

  return (
    <>
      <div className="card-grid mt-8 grid gap-4 sm:grid-cols-3">
        <div className="stat-card rounded-2xl bg-card p-6 shadow-card transition-shadow hover:shadow-card-hover">
          <p className="text-sm font-medium text-muted-foreground">Earned on Clipline</p>
          <p className="mt-2 text-3xl font-black tabular-nums">
            ${(earnedCents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {completedDeals.length} completed deal{completedDeals.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="stat-card rounded-2xl bg-card p-6 shadow-card transition-shadow hover:shadow-card-hover">
          <p className="text-sm font-medium text-muted-foreground">Active deals</p>
          <p className="mt-2 text-3xl font-black tabular-nums">{activeDeals.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeDeals.filter((d) => ["requested", "funded"].includes(d.status)).length} awaiting your response
          </p>
        </div>
        <div className="stat-card rounded-2xl bg-card p-6 shadow-card transition-shadow hover:shadow-card-hover">
          <p className="text-sm font-medium text-muted-foreground">Brand rating</p>
          <p className="mt-2 text-3xl font-black tabular-nums">
            {avgRating !== null ? (<><span className="text-amber">★</span> {avgRating}</>) : (<span className="text-muted-foreground">—</span>)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {myRatings.length > 0 ? `${myRatings.length} brand review${myRatings.length === 1 ? "" : "s"}` : "No reviews yet, they arrive with completed deals"}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="min-w-0 rounded-2xl bg-card p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Recent deals</h2>
            <Link href="/deals" className="text-sm font-medium text-muted-foreground hover:text-foreground">All deals →</Link>
          </div>
          {recentDeals.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              <span aria-hidden className="mx-auto mb-3 block w-fit text-muted-foreground/40"><SendIcon size={36} /></span>
              <p className="font-semibold text-foreground">No bookings yet.</p>
              <p className="mt-1">Share your storefront link. Every booking lands here with a brief, a deadline, and anti-ghosting timers.</p>
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-1.5">
              {recentDeals.map((d) => (
                <li key={d.id}>
                  <Link href={`/deals/${d.id}`} className="deal-row flex items-center justify-between gap-4 rounded-xl border border-transparent bg-secondary/40 px-4 py-3.5 transition-all hover:border-border hover:bg-card">
                    <span className="min-w-0 truncate font-semibold">{d.offering_title}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <Badge variant="secondary" className={["requested", "funded", "revision_requested"].includes(d.status) ? "bg-amber text-amber-foreground hover:bg-amber" : ""}>
                        {STATUS_LABELS[d.status] ?? d.status}
                      </Badge>
                      <span className="font-black tabular-nums">${(d.price_cents / 100).toFixed(0)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-6">
          <section className="overflow-hidden rounded-2xl bg-card shadow-card">
            <div aria-hidden className="h-16" style={gradient ? { background: gradient.css } : { background: "var(--secondary)" }} />
            <div className="p-5">
              <div className="flex items-center justify-between">
                <p className="font-bold">{profile ? `@${profile.handle}` : "Your storefront"}</p>
                {profile && (
                  <Badge variant="secondary" className={profile.status === "live" ? "bg-amber text-amber-foreground hover:bg-amber" : ""}>
                    {profile.status}
                  </Badge>
                )}
              </div>
              <div className="mt-4 flex flex-col gap-1.5 text-sm">
                <Link className="text-muted-foreground hover:text-foreground" href="/dashboard?tab=profile">Edit profile →</Link>
                <Link className="text-muted-foreground hover:text-foreground" href="/onboarding/socials">Socials ({socialCount}) →</Link>
                <Link className="text-muted-foreground hover:text-foreground" href="/dashboard?tab=offerings">Offerings ({offeringCount}) →</Link>
                <Link className="text-muted-foreground hover:text-foreground" href="/dashboard?tab=portfolio">Portfolio ({portfolioCount}) →</Link>
              </div>
            </div>
          </section>

          {openSteps.length > 0 && (
            <section className="rounded-2xl bg-card p-5 shadow-card">
              <h2 className="font-bold">
                Finish setup{" "}
                <span className="text-sm font-medium text-muted-foreground">
                  ({steps.length - openSteps.length + 1}/{steps.length + 1})
                </span>
              </h2>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round(((steps.length - openSteps.length + 1) / (steps.length + 1)) * 100)}%` }} />
              </div>
              <ul className="mt-3 flex flex-col gap-2">
                {openSteps.map((s) => (
                  <li key={s.label}>
                    <Link href={s.href} className="flex items-center gap-2.5 rounded-lg border border-dashed px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary/60">
                      <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full border-2 border-border" />
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Delete the 3 dashboard sub-pages**

```bash
rm app/dashboard/profile/page.tsx
rm app/dashboard/offerings/page.tsx
rm app/dashboard/portfolio/page.tsx
```

Keep the `actions.ts` files in their original directories — the dashboard page imports them.

- [ ] **Step 3: Slim onboarding profile page**

Replace `app/onboarding/profile/page.tsx`:
```tsx
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { saveProfileStep } from "./actions";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { ProfileForm } from "@/components/creator/profile-form";

export default async function OnboardingProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { user } = await requireRole("creator", "/onboarding/profile");
  const { error } = await searchParams;
  const supabase = await createServerSupabase();
  const { data: p } = await supabase
    .from("creator_profiles")
    .select("handle, bio, niches, country, languages, status")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <WizardShell step="profile">
      <ProfileForm
        profile={p}
        action={saveProfileStep}
        mode="wizard"
        error={error}
      />
    </WizardShell>
  );
}
```

- [ ] **Step 4: Slim onboarding offerings page**

Replace `app/onboarding/offerings/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { saveOfferingStep } from "./actions";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { OfferingsPanel } from "@/components/creator/offerings-panel";

export default async function OnboardingOfferingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { user } = await requireRole("creator", "/onboarding/offerings");
  const { error, saved } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: profile } = await supabase
    .from("creator_profiles").select("handle").eq("user_id", user.id).maybeSingle();
  if (!profile) {
    redirect("/onboarding/profile?error=" + encodeURIComponent("Claim your handle first"));
  }

  const { data: offerings } = await supabase
    .from("offerings")
    .select("id, type, title, price_cents")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <WizardShell step="offerings" skip={false}>
      <OfferingsPanel
        offerings={offerings ?? []}
        saveAction={saveOfferingStep}
        mode="wizard"
        continueHref="/onboarding/highlights"
        error={error}
        saved={saved}
      />
    </WizardShell>
  );
}
```

- [ ] **Step 5: Slim onboarding highlights page**

Replace `app/onboarding/highlights/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { addHighlight, removeHighlight } from "./actions";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { PortfolioPanel } from "@/components/creator/portfolio-panel";

export default async function OnboardingHighlightsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { user } = await requireRole("creator", "/onboarding/highlights");
  const { error, saved } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: profile } = await supabase
    .from("creator_profiles").select("handle").eq("user_id", user.id).maybeSingle();
  if (!profile) {
    redirect("/onboarding/profile?error=" + encodeURIComponent("Claim your handle first"));
  }

  const { data: items } = await supabase
    .from("portfolio_items")
    .select("id, media_url, caption")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <WizardShell step="highlights" skip={false}>
      <PortfolioPanel
        items={items ?? []}
        addAction={addHighlight}
        deleteAction={removeHighlight}
        mode="wizard"
        continueHref="/onboarding/publish"
        gradientSeed={profile.handle}
        error={error}
        saved={saved}
      />
    </WizardShell>
  );
}
```

- [ ] **Step 6: Update mobile nav "New" button**

In `components/mobile-nav.tsx` line 18, change:
```ts
// Old:
{ href: "/dashboard/offerings/new", label: "New", icon: SparklesIcon, central: true },
// New:
{ href: "/dashboard?tab=offerings", label: "New", icon: SparklesIcon, central: true },
```

- [ ] **Step 7: Update campaign actions redirect**

In `app/campaigns/[id]/actions.ts`, find the line that redirects to `/dashboard/profile` and change it to `/dashboard?tab=profile`:
```ts
redirect("/dashboard?tab=profile&error=" + encodeURIComponent("Create your profile before applying"));
```

- [ ] **Step 8: Verify build and test**

Run: `npx next build 2>&1 | head -40`
Expected: Clean build. No references to deleted pages. Then start dev server and manually test:
- Navigate all 4 tabs on `/dashboard`
- Complete the onboarding wizard
- Mobile nav "New" button
- Save profile, add offering, add portfolio item — all redirect correctly

- [ ] **Step 9: Commit**

```bash
git add app/dashboard/page.tsx app/onboarding/profile/page.tsx app/onboarding/offerings/page.tsx app/onboarding/highlights/page.tsx components/mobile-nav.tsx app/campaigns/[id]/actions.ts
git rm app/dashboard/profile/page.tsx app/dashboard/offerings/page.tsx app/dashboard/portfolio/page.tsx
git commit -m "feat: consolidate dashboard tabs + unify onboarding/dashboard forms"
```

---

### Task 5: Streamline Inbox Invite → Offer → Deal Flow

**Files:**
- Create: `components/inbox/auto-scroll.tsx`
- Modify: `app/inbox/page.tsx` — add offer badge to invitation cards
- Modify: `app/inbox/[id]/page.tsx` — mount AutoScroll component
- Modify: `app/inbox/actions.ts` — update `respondInvite` redirect
- Test: manual — accept invite, verify auto-scroll, accept offer, verify redirect to deal

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `AutoScroll` client component; updated invitation cards with offer badges

- [ ] **Step 1: Create AutoScroll client component**

`components/inbox/auto-scroll.tsx`:
```tsx
"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function AutoScroll() {
  const searchParams = useSearchParams();
  const focus = searchParams.get("focus");

  useEffect(() => {
    if (focus === "offer") {
      document.getElementById("offer-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focus]);

  return null;
}
```

- [ ] **Step 2: Add offer badge to invitation cards in inbox**

In `app/inbox/page.tsx`, the offers are already queried per conversation (via the messages query block). We need to also query offers. Add an offers query after the `lastMessageById` block (around line 31):

After the `lastMessageById` block, add:
```tsx
const pendingOfferByConv = new Map<string, number>();
if (convIds.length > 0) {
  const { data: offers } = await supabase
    .from("offers")
    .select("conversation_id, price_cents, status")
    .in("conversation_id", convIds)
    .eq("status", "pending");
  for (const o of offers ?? []) {
    if (o.conversation_id && !pendingOfferByConv.has(o.conversation_id)) {
      pendingOfferByConv.set(o.conversation_id, o.price_cents);
    }
  }
}
```

Then in the invitation card rendering (around line 120), after the `{c.invite_message}` paragraph, add the offer badge:
```tsx
{pendingOfferByConv.has(c.id) && (
  <p className="mt-2 text-sm font-medium text-primary">
    Includes an offer · ${(pendingOfferByConv.get(c.id)! / 100).toFixed(0)}
  </p>
)}
```

- [ ] **Step 3: Mount AutoScroll in conversation detail**

In `app/inbox/[id]/page.tsx`, add the import at the top:
```tsx
import { AutoScroll } from "@/components/inbox/auto-scroll";
```

Mount it right after the opening `<main>` tag (around line 125):
```tsx
<main className="mx-auto w-full max-w-3xl px-6 py-10">
  <AutoScroll />
  {/* ... rest of the page */}
```

- [ ] **Step 4: Update respondInvite redirect**

In `app/inbox/actions.ts`, line 42, change the accepted redirect to include `?focus=offer`:
```ts
// Old:
redirect(response === "accepted" ? `/inbox/${id}` : "/inbox");
// New:
redirect(response === "accepted" ? `/inbox/${id}?focus=offer` : "/inbox");
```

Note: `respondOffer` (accept path) at line 151 already redirects to `/deals/${dealId}` — no change needed there.

- [ ] **Step 5: Verify build and test**

Run: `npx next build 2>&1 | head -30`
Expected: Clean build. Then test manually:
- Login as creator, view inbox with a pending invitation that has an offer
- Verify offer badge shows on invitation card
- Accept invite, verify page scrolls to offer section
- Accept offer, verify redirect to deal page

- [ ] **Step 6: Commit**

```bash
git add components/inbox/auto-scroll.tsx app/inbox/page.tsx app/inbox/[id]/page.tsx app/inbox/actions.ts
git commit -m "feat: streamline inbox invite-to-deal flow with offer badges and auto-scroll"
```

---

### Task 6: Deal Detail — Collapsible Timeline + Review Modal + Promoted Actions

**Files:**
- Create: `components/deals/review-modal.tsx`
- Modify: `app/deals/[id]/page.tsx` — collapse timeline, reposition actions, replace inline review
- Test: manual — dev server, view deal at various statuses, test review modal

**Interfaces:**
- Consumes: `submitReview` from `app/deals/[id]/review-actions.ts`, `StarRating` from `components/star-rating.tsx`
- Produces: `ReviewModal` client component

- [ ] **Step 1: Create ReviewModal client component**

`components/deals/review-modal.tsx`:
```tsx
"use client";

import { useRef } from "react";
import { StarRating } from "@/components/star-rating";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ReviewModal({
  dealId,
  action,
}: {
  dealId: string;
  action: (formData: FormData) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <Button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        Leave a review
      </Button>
      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl bg-card p-6 shadow-lg backdrop:bg-black/50"
      >
        <h2 className="text-base font-bold">Leave a review</h2>
        <form action={action} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="deal_id" value={dealId} />
          <div>
            <StarRating name="rating" defaultValue={5} />
          </div>
          <Textarea name="body" rows={3} placeholder="How was the collaboration?" />
          <div className="mt-2 flex gap-2">
            <Button type="submit" className="px-6">Submit review</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
```

- [ ] **Step 2: Modify deal detail page**

In `app/deals/[id]/page.tsx`, make these 3 changes:

**2a. Move "Next steps" section up — right after the status bar (line ~148).** Cut the entire `{actions.length > 0 && ...}` block (lines 249-281) and paste it after the error/reported messages (around line 167), before the deliverables section. Add amber card styling:

Replace the section wrapper class:
```tsx
// Old:
<section className="deal-next-steps mt-6 rounded-2xl bg-card p-6 shadow-card">
// New:
<section className="deal-next-steps mt-4 rounded-2xl border border-amber bg-amber/10 p-6">
```

Also add the review modal button to the actions section when deal is completed and no review exists. Add import at top:
```tsx
import { ReviewModal } from "@/components/deals/review-modal";
```

After the actions loop, inside the section, add:
```tsx
{deal.status === "completed" && !myReview && (
  <div className="mt-3">
    <ReviewModal dealId={deal.id} action={submitReview} />
  </div>
)}
```

**2b. Replace inline review section** (lines 293-306) with nothing — remove the entire `{role !== "admin" && deal.status === "completed" && !myReview && ...}` review section. The review is now in the modal triggered from Next Steps.

**2c. Wrap timeline in `<details>`** (lines 308-346). Replace the timeline section wrapper:
```tsx
// Old:
<section className="mt-6 rounded-2xl bg-secondary/40 p-6">
  <div className="flex items-center justify-between">
    <h2 className="text-base font-bold">Timeline</h2>
    ...
  </div>
  <ul ...>
  ...
  </ul>
</section>

// New:
<details className="mt-6 rounded-2xl bg-secondary/40 p-6">
  <summary className="flex cursor-pointer items-center justify-between">
    <span className="text-base font-bold">
      Timeline · {(events ?? []).length} event{(events ?? []).length !== 1 ? "s" : ""}
    </span>
    <Link href={`/report?deal=${deal.id}`} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
      Report a problem
    </Link>
  </summary>
  <ul className="mt-3 flex flex-col gap-0">
    {/* ... existing timeline items unchanged ... */}
  </ul>
</details>
```

- [ ] **Step 3: Verify build and test**

Run: `npx next build 2>&1 | head -30`
Expected: Clean build. Then test manually:
- View a deal in "requested" status — Next Steps card appears prominently below progress bar
- View a completed deal — "Leave a review" button in Next Steps opens modal
- Timeline is collapsed by default, expand/collapse works
- Submit a review via modal — redirects back to deal page

- [ ] **Step 4: Commit**

```bash
git add components/deals/review-modal.tsx app/deals/[id]/page.tsx
git commit -m "feat: deal detail - collapsible timeline, review modal, promoted action card"
```

---

### Task 7: Campaign Application — Smarter Defaults & Context Card

**Files:**
- Modify: `app/campaigns/[id]/page.tsx` — add `pitchPlaceholder()`, add creator stats query, render context card
- Test: manual — dev server, view campaign as creator, verify placeholder and stats card

**Interfaces:**
- Consumes: `public_creator_stats` view (columns: `creator_id, platform, follower_count, verification_status`), `public_creator_reviews` view
- Produces: nothing (terminal task)

- [ ] **Step 1: Add pitchPlaceholder helper and stats query**

In `app/campaigns/[id]/page.tsx`, add the helper function near the top (after the existing `TYPE_LABELS`):

```tsx
function pitchPlaceholder(offeringType: string): string {
  switch (offeringType) {
    case "dedicated_video":
      return "What angle would you take? Mention your audience size and why they'd care about this product.";
    case "integration":
      return "How would you weave this into your content? What video would this fit naturally into?";
    case "short_form_post":
      return "What hook would you use? What's your typical view count on shorts?";
    case "ugc_video":
      return "Describe your production style and turnaround. Include any relevant past UGC work.";
    default:
      return "Why you're the right creator for this: your angle, your audience, relevant work.";
  }
}
```

- [ ] **Step 2: Update CreatorPanel to accept and use stats**

Add new props to `CreatorPanel`:
```tsx
async function CreatorPanel({
  campaignId,
  open,
  userId,
  budgetMinCents,
  budgetMaxCents,
  offeringType,
  supabase,
}: {
  campaignId: string;
  open: boolean;
  userId: string;
  budgetMinCents: number;
  budgetMaxCents: number;
  offeringType: string;
  supabase: Supabase;
}) {
```

Inside the function, after fetching `mine`, add stats query:
```tsx
const [{ data: stats }, { data: reviews }, { data: completedDeals }] = await Promise.all([
  supabase.from("public_creator_stats").select("platform, follower_count").eq("creator_id", userId),
  supabase.from("public_creator_reviews").select("rating").eq("creator_id", userId),
  supabase.from("deals").select("id", { count: "exact", head: true }).eq("creator_id", userId).eq("status", "completed"),
]);
const totalFollowers = (stats ?? []).reduce((sum, s) => sum + (s.follower_count ?? 0), 0);
const avgRating = (reviews ?? []).length > 0
  ? Math.round(((reviews ?? []).reduce((s, r) => s + (r.rating as number), 0) / (reviews ?? []).length) * 10) / 10
  : null;
```

- [ ] **Step 3: Render context card alongside application form**

In the `CreatorPanel` return block, for the open-campaign application form (the last `return` block starting at line 333), wrap the form in a responsive grid and add the stats card:

```tsx
return (
  <section className="mt-10">
    <h2 className="text-lg font-bold">Apply to this campaign</h2>
    <div className="mt-3 gap-6 md:grid md:grid-cols-[1fr_280px]">
      <form action={applyToCampaign} className="flex max-w-xl flex-col gap-4">
        <input type="hidden" name="campaign_id" value={campaignId} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pitch">Your pitch</Label>
          <Textarea
            id="pitch"
            name="pitch"
            rows={5}
            required
            placeholder={pitchPlaceholder(offeringType)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="proposed_price">Your price (USD)</Label>
          <Input
            id="proposed_price"
            name="proposed_price"
            inputMode="decimal"
            required
            defaultValue={(Math.round((budgetMinCents + budgetMaxCents) / 2) / 100).toFixed(0)}
          />
          <p className="text-xs text-muted-foreground">
            Suggested from the brand&rsquo;s budget — adjust to your rate.
          </p>
        </div>
        <Button type="submit" className="mt-2 self-start">
          Submit application
        </Button>
      </form>

      <aside className="mt-6 h-fit rounded-xl border p-4 md:mt-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your profile</p>
        <dl className="mt-3 flex flex-col gap-2 text-sm">
          {totalFollowers > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Followers</dt>
              <dd className="font-semibold tabular-nums">{totalFollowers.toLocaleString("en-US")}</dd>
            </div>
          )}
          {avgRating !== null && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Rating</dt>
              <dd className="font-semibold"><span className="text-amber">★</span> {avgRating} ({(reviews ?? []).length})</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Completed deals</dt>
            <dd className="font-semibold tabular-nums">{completedDeals.count ?? 0}</dd>
          </div>
          {(stats ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {(stats ?? []).map((s) => (
                <Badge key={s.platform} variant="secondary" className="text-xs">
                  {s.platform}
                </Badge>
              ))}
            </div>
          )}
        </dl>
      </aside>
    </div>
  </section>
);
```

- [ ] **Step 4: Pass offeringType to CreatorPanel**

In the main page component where `CreatorPanel` is called (around line 123), add the `offeringType` prop:
```tsx
<CreatorPanel
  campaignId={campaign.id}
  open={campaign.status === "open" && !windowClosed}
  userId={user.id}
  budgetMinCents={campaign.budget_min_cents}
  budgetMaxCents={campaign.budget_max_cents}
  offeringType={campaign.offering_type}
  supabase={supabase}
/>
```

- [ ] **Step 5: Verify build and test**

Run: `npx next build 2>&1 | head -30`
Expected: Clean build. Then test manually:
- View a campaign as a creator — pitch placeholder changes by offering type
- Stats card shows follower count, rating, completed deals, platform badges
- Application form layout is side-by-side on desktop, stacked on mobile

- [ ] **Step 6: Commit**

```bash
git add app/campaigns/[id]/page.tsx
git commit -m "feat: campaign application - contextual placeholders and creator stats card"
```

---

### Task 8: Notification & Mobile UX Fixes

**Files:**
- Modify: `components/notifications/notification-list.tsx` — add mobile mark-as-read, add quick-action buttons
- Test: manual — dev server, resize to mobile, verify mark-as-read visible, verify quick-action buttons

**Interfaces:**
- Consumes: `NotificationRow` interface (already defined in the same file)
- Produces: nothing (terminal task)

- [ ] **Step 1: Fix mark-as-read visibility on mobile**

In `components/notifications/notification-list.tsx` line 94, update the form className:

```tsx
// Old:
className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
// New:
className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100"
```

- [ ] **Step 2: Add quick-action buttons to actionable notifications**

Add a helper function and update the `NotificationInner` component. Inside `notification-list.tsx`, add a helper above `NotificationInner`:

```tsx
function quickActionLabel(kind: string): string | null {
  switch (kind) {
    case "offer": return "View offer";
    case "booking": case "deal": return "View deal";
    case "application_response": return "Open deal";
    case "invite": return "View invite";
    default: return null;
  }
}
```

Then update `NotificationInner` to show the quick-action button when applicable:

```tsx
function NotificationInner({ n }: { n: NotificationRow }) {
  const actionLabel = quickActionLabel(n.kind);
  return (
    <>
      <span className="flex min-w-0 flex-col">
        <span className={`truncate text-sm ${n.read_at ? "font-medium" : "font-bold"}`}>
          {!n.read_at && (
            <span aria-hidden className="mr-2 inline-block size-2 rounded-full bg-amber align-middle" />
          )}
          {n.title}
        </span>
        {n.body && (
          <span className="mt-0.5 truncate text-sm text-muted-foreground">{n.body}</span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {actionLabel && n.href && (
          <span className="hidden rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex">
            {actionLabel}
          </span>
        )}
        <span className="text-xs text-muted-foreground tabular-nums">
          {timeAgo(n.created_at)}
        </span>
      </span>
    </>
  );
}
```

The button is rendered inside the `<Link>` or `<div>` that already wraps the notification — clicking it navigates to the same `href`. On mobile the button is hidden (`hidden sm:inline-flex`) because the card itself is tappable, but on desktop it adds a visible affordance that the card is clickable.

- [ ] **Step 3: Verify build and test**

Run: `npx next build 2>&1 | head -30`
Expected: Clean build. Then test:
- Resize browser to mobile width — mark-as-read checkmark is always visible (not hover-only)
- Desktop: notifications with offers, deals, invites show labeled quick-action buttons
- Click through still works correctly

- [ ] **Step 4: Commit**

```bash
git add components/notifications/notification-list.tsx
git commit -m "feat: notification mobile mark-as-read + quick-action buttons"
```

---

## Task Summary

| Task | Description | Creates | Modifies | Deletes |
|------|-------------|---------|----------|---------|
| 1 | Extract ProfileForm | 1 component | 1 actions file | — |
| 2 | Extract OfferingsPanel | 1 component | 1 actions file | — |
| 3 | Extract PortfolioPanel | 1 component | 1 actions file | — |
| 4 | Dashboard tabs + onboarding unification | — | 6 files | 3 pages |
| 5 | Inbox invite→deal flow | 1 component | 3 files | — |
| 6 | Deal detail improvements | 1 component | 1 file | — |
| 7 | Campaign application defaults | — | 1 file | — |
| 8 | Notification mobile UX | — | 1 file | — |
