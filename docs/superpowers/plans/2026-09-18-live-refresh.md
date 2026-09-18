# Live Refresh (Polling) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cross-user UI freshness via polling — User A acts, User B sees the update within 5 seconds without manual refresh.

**Architecture:** A single `"use client"` component (`LiveRefresh`) calls `router.refresh()` every 5s. It renders `null` and lives in `AppShell`, so every authenticated page gets it for free. The component is the **only** thing to touch when migrating to Supabase Realtime — swap its internals from `setInterval` to a Realtime subscription, same mount point, same contract.

**Tech Stack:** Next.js `useRouter`, React `useEffect`/`useRef`, `document.hidden` for tab-awareness.

## Global Constraints

- No new dependencies.
- Polling pauses when the browser tab is backgrounded (saves requests).
- Component must render `null` — no DOM footprint.
- The component includes a `ponytail:` comment documenting the polling→Realtime migration path for future agents.

---

### Task 1: Create the `LiveRefresh` component

**Files:**
- Create: `components/live-refresh.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `<LiveRefresh />` — a zero-DOM client component. No props needed (interval is hardcoded; YAGNI on configurability until someone asks).

- [ ] **Step 1: Create the component**

```tsx
// components/live-refresh.tsx
"use client";

// ponytail: polling at 5s interval — swap to Supabase Realtime when concurrent
// users exceed ~500 open tabs. Migration: replace the setInterval in useEffect
// with a supabase.channel(...).on('postgres_changes', ...) subscription that
// calls router.refresh() on relevant table changes. Same mount point in
// AppShell, same contract (renders null, triggers RSC re-render).

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 5_000;

export function LiveRefresh() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    timer.current = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, INTERVAL_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [router]);

  return null;
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors (two pre-existing unrelated errors are fine)

- [ ] **Step 3: Commit**

```bash
git add components/live-refresh.tsx
git commit -m "feat: add LiveRefresh polling component (5s interval)"
```

---

### Task 2: Mount `LiveRefresh` in `AppShell`

**Files:**
- Modify: `components/app-shell.tsx`

**Interfaces:**
- Consumes: `<LiveRefresh />` from Task 1
- Produces: all pages wrapped by `AuthenticatedShell` now auto-refresh every 5s

- [ ] **Step 1: Add the import and render**

In `components/app-shell.tsx`, add `LiveRefresh` as a sibling inside the outer `<div>`:

```tsx
import { LiveRefresh } from "@/components/live-refresh";
```

Then inside the return, as the first child of the outer div:

```tsx
<div className="flex h-dvh bg-[var(--ground)]">
  <LiveRefresh />
  <div className="hidden md:block">
    <AppRail {...railProps} />
  </div>
  ...
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Manual smoke test**

1. Open the app in two browser tabs as different users (brand + creator).
2. As User A, send a message / create a deal / change campaign status.
3. Watch User B's tab — it should reflect the change within ~5 seconds without manual refresh.
4. Background User B's tab, perform another action as User A, then foreground B — it should refresh on the next interval tick after foregrounding.

- [ ] **Step 4: Commit**

```bash
git add components/app-shell.tsx
git commit -m "feat: mount LiveRefresh in AppShell for cross-user freshness"
```
