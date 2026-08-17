# Phase 6a: Admin & Polish (Unblocked Subset) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everything launch-blocking that needs no external service: an admin panel (users/suspension, disputed-deal resolution, reports), a shared nav with logout for both roles, login return-to, a report-a-problem flow, and the Phase-4 error-copy fixes.

**Architecture:** Admin access rides on RLS policies gated by `profiles.role='admin'` (new migration) — no service-role key in page code, ever. Admin actions reuse the existing `transition_deal` RPC (`resolve_release`/`resolve_refund` as actor `admin`) and the suspension trigger (which already permits admin sessions once RLS lets them reach the row). Nav is a small server component included by authenticated pages (the root layout stays static so ISR pages are unaffected). Login gains a validated `next` param.

**Tech Stack:** Existing stack. No new dependencies, no new external services.

**Spec:** `docs/superpowers/specs/2026-08-16-video-micro-influencer-marketplace-design.md` (admin module) + Phase 1/2/4 carry-forward ledgers.

## Global Constraints

- Admins are created ONLY via SQL (`update public.profiles set role='admin' where id='<uuid>';` as service role) — no UI path, ever (Phase-1 security rulings).
- Admin pages open with `requireRole("admin")`; admin data access via new RLS policies, NOT the service-role key.
- Dispute resolution uses `transition_deal(deal_id, 'resolve_release'|'resolve_refund', 'admin')` — never direct writes.
- Suspension flips `creator_profiles.status` via a normal authenticated update (new admin RLS policy + existing trigger allow it); unsuspending returns status to 'draft' (never силently to 'live' — the creator re-publishes).
- `next` redirect param must be validated: relative paths starting with `/` only, no `//`, no scheme — otherwise fall back to role default.
- Error-copy rules: RPC business errors (from our own `raise exception` messages) pass through verbatim; known codes map to friendly text (23505/42501 on reviews → "You already reviewed this deal" / not-allowed); any OTHER database error surfaces as "Something went wrong — please try again" (the detail stays server-side in logs).
- Storefront `/c/[handle]` and `/` stay static/ISR; root layout untouched by nav work.
- Local Supabase workflow as prior phases; explicit grants for anything new; commit per task; test/lint/build clean per task.

---

### Task 1: Migration 0013 — admin RLS policies

**Files:**
- Create: `supabase/migrations/0013_admin_policies.sql`

**Interfaces:**
- Produces: a reusable `public.is_admin()` helper (security definer, stable) and admin SELECT policies on `deals`, `briefs`, `deal_events`, `messages`, `reports`, plus `creator_profiles` admin SELECT (all statuses) + admin UPDATE (suspension), plus `reports` admin UPDATE (resolution fields). Closes the Phase-1 carry-forward "admin RLS on creator_profiles".

- [ ] **Step 1: Write the migration**

`supabase/migrations/0013_admin_policies.sql`:
```sql
-- Admin access rides on RLS, not the service-role key (spec: admin module).
-- is_admin() is SECURITY DEFINER so policies can check profiles.role without
-- recursive RLS evaluation on profiles.

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create policy "admins read all deals"
  on public.deals for select to authenticated
  using (public.is_admin());

create policy "admins read all briefs"
  on public.briefs for select to authenticated
  using (public.is_admin());

create policy "admins read all deal events"
  on public.deal_events for select to authenticated
  using (public.is_admin());

create policy "admins read all messages"
  on public.messages for select to authenticated
  using (public.is_admin());

create policy "admins read all creator profiles"
  on public.creator_profiles for select to authenticated
  using (public.is_admin());

create policy "admins update creator profiles"
  on public.creator_profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins read all reports"
  on public.reports for select to authenticated
  using (public.is_admin());

create policy "admins resolve reports"
  on public.reports for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- reports.update was never granted to authenticated; grant it now (RLS gates rows)
grant update on table public.reports to authenticated;
```

- [ ] **Step 2: Apply** — `npx supabase migration up`.

- [ ] **Step 3: Verify via psql** — `select count(*) from pg_policies where policyname like 'admins %';` → 8. Functional: create a GoTrue user, promote to admin via `update public.profiles set role='admin' ...` as postgres, get a session token (GoTrue password grant), and via REST with that token confirm: can read a deal it's not party to; can read all creator_profiles regardless of status. With a NON-admin token: same requests return empty/403 as before (policies additive, `is_admin()` false). Clean up fixtures.

- [ ] **Step 4: Commit**

```bash
git add supabase
git commit -m "feat: admin RLS policies via is_admin helper"
```

---

### Task 2: Shared nav + login return-to

**Files:**
- Create: `components/site-nav.tsx`
- Modify: `lib/auth/require.ts` (gates redirect to `/login?next=<path>`), `app/(auth)/login/page.tsx` + `app/(auth)/actions.ts` (honor validated `next`), `app/dashboard/page.tsx` (replace inline logout with nav), `app/discover/page.tsx`, `app/deals/page.tsx`, `app/deals/[id]/page.tsx`, `app/dashboard/profile/page.tsx`, `app/dashboard/offerings/page.tsx`, `app/dashboard/portfolio/page.tsx`, `app/book/[offeringId]/page.tsx` (render nav at top)
- Test: `lib/auth/__tests__/safe-next.test.ts`

**Interfaces:**
- Produces: `SiteNav` server component (`role` + `displayName?` props — links: creators → Dashboard/Deals, brands → Discover/Deals, admins → Admin/Deals; always a Log out form button using the existing `logout` action); `safeNext(raw: string | null | undefined): string | null` exported from `lib/auth/require.ts` (pure). Gates now call `redirect("/login?next=" + encodeURIComponent(currentPath))` — current path passed in by callers via a new optional arg `requireUser(currentPath?: string)` / `requireRole(role, currentPath?)` (omitted → plain `/login`).

- [ ] **Step 1: TDD safeNext**

`lib/auth/__tests__/safe-next.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { safeNext } from "@/lib/auth/require";

describe("safeNext", () => {
  it("accepts internal absolute paths", () => {
    expect(safeNext("/deals/abc")).toBe("/deals/abc");
    expect(safeNext("/discover?niche=gaming")).toBe("/discover?niche=gaming");
  });
  it("rejects protocol-relative, schemed, and relative junk", () => {
    expect(safeNext("//evil.com")).toBeNull();
    expect(safeNext("https://evil.com")).toBeNull();
    expect(safeNext("javascript:alert(1)")).toBeNull();
    expect(safeNext("deals")).toBeNull();
    expect(safeNext("")).toBeNull();
    expect(safeNext(null)).toBeNull();
    expect(safeNext(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: RED** — focused run fails (safeNext not exported).

- [ ] **Step 3: Implement in `lib/auth/require.ts`**

Add (and export):
```ts
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}
```
Change the gates:
```ts
export async function requireUser(currentPath?: string) {
  const { user, role } = await getUserAndRole();
  const d = gateDecision(user, role, null);
  if ("redirect" in d) {
    redirect(d.redirect === "/login" && currentPath
      ? `/login?next=${encodeURIComponent(currentPath)}`
      : d.redirect);
  }
  if (!role) redirect("/");
  return { user: user!, role };
}
```
(same pattern in `requireRole`). Existing callers keep working (arg optional); update the page callers listed above to pass their own path (e.g. `requireUser("/deals")`, `requireRole("brand", \`/book/${offeringId}\`)`, deal detail passes `\`/deals/${id}\``).

- [ ] **Step 4: Login honors next** — `app/(auth)/login/page.tsx`: accept `searchParams` `next`, render `<input type="hidden" name="next" value={next ?? ""} />`. In `app/(auth)/actions.ts` `login()`: after the profile lookup, `const target = safeNext(String(formData.get("next") ?? "")) ?? (profile?.role === "creator" ? "/dashboard" : profile?.role === "admin" ? "/admin" : "/discover");` then `redirect(target)` (import safeNext from `@/lib/auth/require`).

- [ ] **Step 5: SiteNav**

`components/site-nav.tsx`:
```tsx
import Link from "next/link";
import { logout } from "@/app/(auth)/actions";

export function SiteNav({ role }: { role: "creator" | "brand" | "admin" }) {
  const links =
    role === "creator"
      ? [{ href: "/dashboard", label: "Dashboard" }, { href: "/deals", label: "Deals" }]
      : role === "admin"
        ? [{ href: "/admin", label: "Admin" }, { href: "/deals", label: "Deals" }]
        : [{ href: "/discover", label: "Discover" }, { href: "/deals", label: "Deals" }];
  return (
    <nav className="flex items-center justify-between border-b px-8 py-3 mb-2">
      <div className="flex items-center gap-6">
        <Link href="/" className="font-semibold">Clipline</Link>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="text-sm underline-offset-4 hover:underline">
            {l.label}
          </Link>
        ))}
      </div>
      <form action={logout}>
        <button className="text-sm underline">Log out</button>
      </form>
    </nav>
  );
}
```
Render `<SiteNav role={role} />` as the first element (before `<main>`) in every authenticated page listed in Files (each already calls a gate that returns `role`). Remove the now-redundant inline logout form + header row from `app/dashboard/page.tsx`.

- [ ] **Step 6: Verify** — build (all static/ISR routes unchanged — `/`, `/c/[handle]` untouched), test (new safeNext tests green), lint. Manual: nav on all authed pages for both roles; logout works from a brand page; logged-out visit to `/deals/<id>` → login → lands back on that deal.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: shared nav with logout and validated login return-to"
```

---

### Task 3: Error-copy pass

**Files:**
- Create: `lib/errors.ts`
- Modify: `app/deals/[id]/review-actions.ts`, `app/deals/[id]/actions.ts`, `app/deals/[id]/message-actions.ts`, `app/book/[offeringId]/actions.ts`
- Test: `lib/__tests__/errors.test.ts`

**Interfaces:**
- Produces: `friendlyDbError(error: { code?: string; message?: string } | null, fallbacks?: Record<string, string>): string` — returns a mapped message for a known code (from `fallbacks`), passes through messages that came from our own `raise exception` calls (PostgREST surfaces them verbatim; they are the RPC's intentional business copy — heuristic: pass through when `code` is `P0001` (raise_exception)), otherwise returns "Something went wrong — please try again."

- [ ] **Step 1: TDD**

`lib/__tests__/errors.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { friendlyDbError } from "@/lib/errors";

describe("friendlyDbError", () => {
  it("maps known codes", () => {
    expect(friendlyDbError({ code: "23505", message: "duplicate key value" },
      { "23505": "You already reviewed this deal" }))
      .toBe("You already reviewed this deal");
    expect(friendlyDbError({ code: "42501", message: "new row violates row-level security" },
      { "42501": "You can only review completed deals you were part of" }))
      .toBe("You can only review completed deals you were part of");
  });
  it("passes through our own raised business errors", () => {
    expect(friendlyDbError({ code: "P0001", message: "revision limit reached" }))
      .toBe("revision limit reached");
  });
  it("hides everything else behind a generic message", () => {
    expect(friendlyDbError({ code: "23503", message: "fk violation on deals_creator_id" }))
      .toBe("Something went wrong — please try again.");
    expect(friendlyDbError(null)).toBe("Something went wrong — please try again.");
  });
});
```

- [ ] **Step 2: RED** — module not found.

- [ ] **Step 3: Implement**

`lib/errors.ts`:
```ts
const GENERIC = "Something went wrong — please try again.";

export function friendlyDbError(
  error: { code?: string; message?: string } | null,
  fallbacks: Record<string, string> = {}
): string {
  if (!error) return GENERIC;
  if (error.code && fallbacks[error.code]) return fallbacks[error.code];
  // P0001 = plpgsql RAISE EXCEPTION: our own intentional business copy
  if (error.code === "P0001" && error.message) return error.message;
  return GENERIC;
}
```

- [ ] **Step 4: Wire into the four action files** — every place that currently does `encodeURIComponent(error.message)` (or `dErr?.message ?? …`) becomes `encodeURIComponent(friendlyDbError(error, {...}))` with per-site maps:
  - review-actions: `{ "23505": "You already reviewed this deal", "42501": "You can only review completed deals you were part of" }`
  - deal actions (`performDealAction`/`markPaid`): no map — P0001 passthrough covers the RPC copy
  - message-actions: `{ "42501": "You can only message on your own deals" }`
  - booking action: `{ "42501": "You can only book as a brand account" }` for the deal insert; brief insert keeps its prefixed message but wraps the raw part: `"Deal created but the brief failed to save: " + friendlyDbError(bErr)`

- [ ] **Step 5: Verify** — test/lint/build clean. Manual spot-check: duplicate review now shows the friendly message via the real REST path (previously raw 42501 text); an RPC business error (e.g. accepting twice) still shows its exact copy.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: consistent friendly error copy with business-error passthrough"
```

---

### Task 4: Report a problem

**Files:**
- Create: `app/report/page.tsx`, `app/report/actions.ts`
- Modify: `app/deals/[id]/page.tsx` (add a small "Report a problem" link to `/report?deal=<id>` near the timeline)

**Interfaces:**
- Consumes: `reports` table (insert policy: reporter files own; RLS from Phase 1), `parseText`.
- Produces: `/report?deal=<uuid>` (deal optional) — form (reason, ≤2000 required) → `fileReport(formData)` → insert → redirect back to the deal (or `/deals`) with `?reported=1`; the deal page shows "Thanks — our team will take a look." on that flag.

- [ ] **Step 1: Action**

`app/report/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseText } from "@/lib/storefront/validation";
import { friendlyDbError } from "@/lib/errors";

export async function fileReport(formData: FormData) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const dealId = String(formData.get("deal_id") ?? "").trim() || null;
  const reason = parseText(String(formData.get("reason") ?? ""), 2000);
  const back = dealId ? `/deals/${dealId}` : "/deals";

  if (!reason) {
    redirect(`/report?deal=${dealId ?? ""}&error=` +
      encodeURIComponent("Describe the problem (max 2000 characters)"));
  }

  const { error } = await supabase
    .from("reports")
    .insert({ reporter_id: user.id, deal_id: dealId, reason });
  if (error) redirect(`/report?deal=${dealId ?? ""}&error=` + encodeURIComponent(friendlyDbError(error)));

  redirect(`${back}?reported=1`);
}
```

- [ ] **Step 2: Page**

`app/report/page.tsx`:
```tsx
import { requireUser } from "@/lib/auth/require";
import { SiteNav } from "@/components/site-nav";
import { fileReport } from "./actions";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ deal?: string; error?: string }>;
}) {
  const { role } = await requireUser("/report");
  const { deal, error } = await searchParams;

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-semibold mb-2">Report a problem</h1>
        <p className="text-sm text-gray-600 mb-6">
          Tell us what went wrong{deal ? " with this deal" : ""}. Our team reviews every report.
        </p>
        {error && <p className="mb-4 text-red-600">{error}</p>}
        <form action={fileReport} className="flex flex-col gap-4">
          <input type="hidden" name="deal_id" value={deal ?? ""} />
          <textarea name="reason" rows={6} required className="border rounded p-2"
            placeholder="What happened?" />
          <button className="bg-black text-white rounded p-2">Submit report</button>
        </form>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Deal-page link + confirmation** — in `app/deals/[id]/page.tsx`: accept `reported` in searchParams; show `<p className="mb-4 text-green-700">Thanks — our team will take a look.</p>` when set; add near the timeline heading: `<Link href={\`/report?deal=${deal.id}\`} className="text-xs underline text-gray-500">Report a problem</Link>`.

- [ ] **Step 4: Verify** — gates clean; manual: file a report from a deal (row in psql with reporter/deal), confirmation shows; empty reason errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: report-a-problem flow"
```

---

### Task 5: Admin panel

**Files:**
- Create: `app/admin/page.tsx`, `app/admin/actions.ts`, `app/admin/deals/[id]/page.tsx`

**Interfaces:**
- Consumes: admin RLS (T1), `transition_deal` admin actions, suspension trigger, `SiteNav`.
- Produces: `/admin` — three sections: Disputed deals (links to admin deal view), Open reports (with resolve form), Creators (live/draft/suspended with suspend/unsuspend buttons). `/admin/deals/[id]` — read-only deal view (brief, events, messages) + `resolve_release`/`resolve_refund` buttons for disputed deals. Server actions: `resolveDispute(formData)` (deal_id, resolution: release|refund), `resolveReport(formData)` (report_id, resolution ≤500), `setCreatorSuspension(formData)` (user_id, suspend: "true"|"false").

- [ ] **Step 1: Actions**

`app/admin/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseText } from "@/lib/storefront/validation";
import { friendlyDbError } from "@/lib/errors";

export async function resolveDispute(formData: FormData) {
  await requireRole("admin");
  const supabase = await createServerSupabase();
  const dealId = String(formData.get("deal_id") ?? "");
  const resolution = formData.get("resolution") === "release" ? "resolve_release" : "resolve_refund";

  const { error } = await supabase.rpc("transition_deal", {
    p_deal_id: dealId, p_action: resolution, p_actor_role: "admin", p_payload: {},
  });
  if (error) redirect(`/admin/deals/${dealId}?error=` + encodeURIComponent(friendlyDbError(error)));
  revalidatePath(`/admin/deals/${dealId}`);
  revalidatePath("/admin");
  redirect(`/admin/deals/${dealId}?resolved=1`);
}

export async function resolveReport(formData: FormData) {
  await requireRole("admin");
  const supabase = await createServerSupabase();
  const reportId = String(formData.get("report_id") ?? "");
  const resolution = parseText(String(formData.get("resolution") ?? ""), 500);
  if (!resolution) redirect("/admin?error=" + encodeURIComponent("Write a short resolution note (max 500 chars)"));

  const { error } = await supabase
    .from("reports")
    .update({ resolution, resolved_at: new Date().toISOString() })
    .eq("id", reportId);
  if (error) redirect("/admin?error=" + encodeURIComponent(friendlyDbError(error)));
  revalidatePath("/admin");
  redirect("/admin?saved=1");
}

export async function setCreatorSuspension(formData: FormData) {
  await requireRole("admin");
  const supabase = await createServerSupabase();
  const userId = String(formData.get("user_id") ?? "");
  const suspend = formData.get("suspend") === "true";

  const { data: cp, error: readErr } = await supabase
    .from("creator_profiles").select("handle, status").eq("user_id", userId).maybeSingle();
  if (readErr || !cp) redirect("/admin?error=" + encodeURIComponent(friendlyDbError(readErr)));

  const status = suspend ? "suspended" : "draft"; // unsuspend never silently re-publishes
  const { error } = await supabase
    .from("creator_profiles").update({ status }).eq("user_id", userId);
  if (error) redirect("/admin?error=" + encodeURIComponent(friendlyDbError(error)));

  revalidatePath(`/c/${cp.handle}`);
  revalidatePath("/admin");
  redirect("/admin?saved=1");
}
```

- [ ] **Step 2: Admin home**

`app/admin/page.tsx`:
```tsx
import Link from "next/link";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { SiteNav } from "@/components/site-nav";
import { resolveReport, setCreatorSuspension } from "./actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { role } = await requireRole("admin", "/admin");
  const { error, saved } = await searchParams;
  const supabase = await createServerSupabase();

  const [{ data: disputed }, { data: reports }, { data: creators }] = await Promise.all([
    supabase.from("deals")
      .select("id, offering_title, price_cents, requested_at")
      .eq("status", "disputed").order("requested_at"),
    supabase.from("reports")
      .select("id, reason, deal_id, created_at")
      .is("resolved_at", null).order("created_at"),
    supabase.from("creator_profiles")
      .select("user_id, handle, status").order("handle"),
  ]);

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold mb-6">Admin</h1>
        {error && <p className="mb-4 text-red-600">{error}</p>}
        {saved && <p className="mb-4 text-green-700">Saved.</p>}

        <section className="mb-8">
          <h2 className="text-lg font-medium mb-3">Disputed deals ({(disputed ?? []).length})</h2>
          <ul className="flex flex-col gap-2">
            {(disputed ?? []).map((d) => (
              <li key={d.id}>
                <Link href={`/admin/deals/${d.id}`} className="border rounded p-3 flex justify-between hover:bg-gray-50">
                  <span>{d.offering_title}</span>
                  <span>${(d.price_cents / 100).toFixed(2)}</span>
                </Link>
              </li>
            ))}
            {(disputed ?? []).length === 0 && <li className="text-sm text-gray-500">None open.</li>}
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-medium mb-3">Open reports ({(reports ?? []).length})</h2>
          <ul className="flex flex-col gap-3">
            {(reports ?? []).map((r) => (
              <li key={r.id} className="border rounded p-4">
                <p className="text-sm whitespace-pre-line mb-1">{r.reason}</p>
                {r.deal_id && (
                  <Link className="text-xs underline" href={`/admin/deals/${r.deal_id}`}>
                    View deal
                  </Link>
                )}
                <form action={resolveReport} className="flex gap-2 mt-2">
                  <input type="hidden" name="report_id" value={r.id} />
                  <input name="resolution" placeholder="Resolution note" required
                    className="border rounded p-2 flex-1 text-sm" />
                  <button className="border rounded px-3 text-sm">Resolve</button>
                </form>
              </li>
            ))}
            {(reports ?? []).length === 0 && <li className="text-sm text-gray-500">None open.</li>}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-medium mb-3">Creators</h2>
          <ul className="flex flex-col gap-2">
            {(creators ?? []).map((c) => (
              <li key={c.user_id} className="border rounded p-3 flex justify-between items-center">
                <span className="text-sm">@{c.handle} · {c.status}</span>
                <form action={setCreatorSuspension}>
                  <input type="hidden" name="user_id" value={c.user_id} />
                  <input type="hidden" name="suspend" value={c.status === "suspended" ? "false" : "true"} />
                  <button className="text-sm underline">
                    {c.status === "suspended" ? "Unsuspend (to draft)" : "Suspend"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Admin deal view**

`app/admin/deals/[id]/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { SiteNav } from "@/components/site-nav";
import { resolveDispute } from "../../actions";

export default async function AdminDealPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; resolved?: string }>;
}) {
  const { role } = await requireRole("admin", "/admin");
  const { id } = await params;
  const { error, resolved } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: deal } = await supabase.from("deals").select("*").eq("id", id).maybeSingle();
  if (!deal) notFound();

  const [{ data: brief }, { data: events }, { data: messages }] = await Promise.all([
    supabase.from("briefs").select("goals, product_description, talking_points").eq("deal_id", id).maybeSingle(),
    supabase.from("deal_events").select("action, from_status, to_status, created_at").eq("deal_id", id).order("created_at"),
    supabase.from("messages").select("sender_id, body, created_at").eq("deal_id", id).order("created_at"),
  ]);

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto max-w-2xl p-8">
        <Link href="/admin" className="text-sm underline">← Admin</Link>
        <h1 className="text-2xl font-semibold mt-2 mb-1">{deal.offering_title}</h1>
        <p className="mb-4">
          Status: <span className="font-medium">{deal.status}</span> ·
          ${(deal.price_cents / 100).toFixed(2)} · {deal.payment_mode}
          {deal.marked_paid_at && " · marked paid"}
        </p>
        {error && <p className="mb-4 text-red-600">{error}</p>}
        {resolved && <p className="mb-4 text-green-700">Dispute resolved.</p>}

        {deal.status === "disputed" && (
          <section className="mb-6 border rounded p-4 bg-amber-50">
            <h2 className="font-medium mb-3">Resolve dispute</h2>
            <div className="flex gap-3">
              <form action={resolveDispute}>
                <input type="hidden" name="deal_id" value={deal.id} />
                <input type="hidden" name="resolution" value="release" />
                <button className="bg-black text-white rounded px-4 py-2 text-sm">
                  Release to creator (complete)
                </button>
              </form>
              <form action={resolveDispute}>
                <input type="hidden" name="deal_id" value={deal.id} />
                <input type="hidden" name="resolution" value="refund" />
                <button className="border border-red-300 text-red-700 rounded px-4 py-2 text-sm">
                  Refund brand (cancel)
                </button>
              </form>
            </div>
          </section>
        )}

        {brief && (
          <section className="mb-6 border rounded p-4">
            <h2 className="font-medium mb-2">Brief</h2>
            <p className="text-sm whitespace-pre-line">{brief.goals}</p>
          </section>
        )}

        <section className="mb-6 border rounded p-4">
          <h2 className="font-medium mb-2">Messages ({(messages ?? []).length})</h2>
          <ul className="text-sm flex flex-col gap-2">
            {(messages ?? []).map((m, i) => (
              <li key={i} className="border-b pb-1">
                <span className="text-gray-500">{new Date(m.created_at).toLocaleString()}:</span>{" "}
                <span className="whitespace-pre-line">{m.body}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-medium mb-2">Timeline</h2>
          <ul className="text-sm text-gray-600 flex flex-col gap-1">
            {(events ?? []).map((e, i) => (
              <li key={i}>
                {new Date(e.created_at).toLocaleString()} — {e.action}
                {e.from_status !== e.to_status ? ` (${e.from_status} → ${e.to_status})` : ""}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
```

- [ ] **Step 4: Verify** — gates clean. Manual: promote a fixture user to admin (psql), log in → `/admin`; resolve a disputed fixture deal both ways (release → completed, refund → cancelled — separate deals); resolve a report; suspend a live creator (storefront 404s after revalidate; creator's own dashboard shows suspended; unsuspend returns to draft); non-admin hitting `/admin` bounces to `/`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: admin panel — disputes, reports, suspension"
```

---

## Final fix wave (post-review, commit 13f6d80)

safeNext rejects backslashes (open-redirect bypass closed, tested); admin review-form guard; encoded dealId redirects in report actions; strict resolution validation in resolveDispute.

## Carry-forward (final-review triage, 2026-08-17)

- One hardening migration, later: consolidate the 7 double-permissive policy pairs from 0013, wrap `is_admin()` calls as `(select public.is_admin())` (definer functions aren't inlined), column-limit the reports UPDATE grant to (resolution, resolved_at)
- Next error-copy touch: extend friendlyDbError to profile/offerings/portfolio actions; encode dealId in resolveDispute's RPC-error redirect
- fileReport loses return-to context on session expiry (cosmetic)

### Task 6: Phase 6a verification sweep

- [ ] **Step 1: Gates** — test/lint/build; route table: `/`, `/c/[handle]` still static/ISR; admin routes dynamic.
- [ ] **Step 2: Advisors** — only the three triaged definer-view/citext findings.
- [ ] **Step 3: e2e** — full pass: dispute a deal as brand → admin resolves (both directions on two deals) → statuses/events verified; report → resolve; suspend/unsuspend with storefront + discovery disappearance checks; login return-to round trip; nav/logout from both roles; duplicate-review copy now friendly (regression from T3); non-admin `/admin` bounce. Clean up fixtures.
- [ ] **Step 4: Commit fixes** only if needed: `chore: phase 6a verification fixes`
