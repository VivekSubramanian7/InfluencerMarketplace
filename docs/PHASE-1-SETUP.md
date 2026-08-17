# Phase 1 — Setup & Deployment Steps

Verified against Supabase docs and changelog on 2026-08-17 (CLI 2.114.0, changelog current to 2026-07-30).

> **Why our migrations carry explicit `grant` statements:** Supabase's 2026-04-28
> breaking change means new tables in `public` are **no longer auto-exposed** to the
> Data API (enforced platform-wide 2026-10-30). Every table must opt in via explicit
> grants to `anon`/`authenticated`/`service_role` — which our five migrations already
> do, with least privilege per table. Local and hosted now behave identically here.

---

## A. Local development (clean machine)

Prerequisites: Node 20+ (we use 24), Docker Desktop running, git.

1. **Install dependencies**
   ```bash
   npm ci
   ```
2. **Start the local Supabase stack** (first run pulls Docker images, takes minutes)
   ```bash
   npx supabase start
   ```
3. **Create `.env.local`** — copy `.env.local.example`, fill from `npx supabase status`:
   - `NEXT_PUBLIC_SUPABASE_URL` → API URL (http://127.0.0.1:54321)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → anon key
   - `SUPABASE_SERVICE_ROLE_KEY` → service_role key
   (Local stack still issues legacy-style keys; hosted uses the new key format — see B3.)
4. **Apply migrations**
   ```bash
   npx supabase db reset
   ```
   Applies `0001`–`0005` (schema, RLS, grants, state-machine seed). `WARN: no files
   matched pattern: supabase/seed.sql` is expected — we have no seed file yet.
5. **Verify the toolchain**
   ```bash
   npm test        # 19/19
   npm run lint    # exit 0
   npm run build   # clean
   ```
6. **Run the app**
   ```bash
   npm run dev
   ```
   Smoke test: sign up at `/signup` as a Video creator → lands on `/dashboard`;
   sign up as a Brand → lands on `/discover`; logged-out visits to either bounce
   to `/login`. Local auth has email confirmation disabled, so signup logs in
   immediately.
7. **Database checks** (optional but recommended after schema changes)
   ```bash
   npx supabase db advisors --local
   ```
   Expected findings at Phase 1 close — all triaged, see section C.

Stop the stack with `npx supabase stop` (add `--no-backup` to discard data).

### Changing the deal state machine (local-only phase)

`lib/deals/machine.ts` is the single source of truth. After editing it:
```bash
npm run gen:transitions   # regenerates supabase/migrations/0005_transitions_seed.sql
npx supabase db reset
npm test                  # the drift test fails if you forget gen:transitions
```
**After the hosted project has ever run `db push`, never regenerate 0005 in place** —
applied migrations are recorded by filename and edits won't redeploy. Emit a new
timestamped migration instead (`npx supabase migration new transitions_update` and
paste the generator output).

---

## B. Hosted project (staging/production)

1. **Create the project** at https://database.new (choose region near your users).
   Save the database password in a password manager.
2. **Link and push migrations**
   ```bash
   npx supabase link --project-ref <PROJECT_REF>
   npx supabase db push
   ```
   Applies all five migrations in order. The explicit grants in them are the
   Data-API opt-in (see note at top) — no dashboard toggling needed per table.
3. **API keys** — use the **new key system** (legacy `anon`/`service_role` JWT keys
   are deprecated end of 2026):
   - Dashboard → Settings → API Keys → create/copy the **publishable key**
     (`sb_publishable_...`) → set as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy a **secret key** (`sb_secret_...`) → set as `SUPABASE_SERVICE_ROLE_KEY`
     (server-only; never `NEXT_PUBLIC_`)
   - `@supabase/ssr` accepts these in place of the legacy keys unchanged.
4. **Auth configuration** (Dashboard → Authentication):
   - **URL Configuration**: Site URL = your production URL; add
     `https://<your-domain>/auth/callback` (and your Vercel preview wildcard,
     e.g. `https://*-yourteam.vercel.app/auth/callback`) to Redirect URLs.
   - **Email confirmation**: hosted projects enable it by default. Known Phase 1
     caveat: with confirmation ON, our `signup()` action redirects to the role
     landing page but the user has no session until they click the email link —
     they'll see `/login` with no explanation. Either disable confirmation until
     the Phase 2 "check your email" screen lands, or accept the rough edge.
   - **Password policy**: set minimum length to 8 to match the signup form
     (project default is 6; the form enforces 8 only client-side).
5. **Deploy the app** (Vercel): set the three env vars from step 3 for
   Production + Preview. `SUPABASE_SERVICE_ROLE_KEY` is unused by Phase 1 code
   but Phase 4/5 (webhooks, stats sync) will need it — setting it now is fine.
6. **Post-deploy verification**
   ```bash
   npx supabase db advisors    # hosted advisors; expect only section-C findings
   ```
   Then repeat the A6 smoke test against the deployed URL (remember the email
   confirmation caveat). Confirm in Dashboard → Database → Tables that all
   tables show **RLS enabled**.

### Before first hosted push (cheap now, migration-required later)

From the Phase 1 carry-forward list — both are edits to migration 0001 that are
free while no hosted DB exists:
- Move `citext` out of `public`:
  `create extension if not exists citext with schema extensions;` (advisor WARN 0014)
- Decide whether to keep or restructure the definer view (see C1).

---

## C. Known advisor findings (triaged 2026-08-17)

1. **ERROR `security_definer_view` on `public.public_creator_stats` — intentional.**
   The base table (`connected_accounts`) is deliberately owner-only because it
   holds `token_ref`; the definer view is the curated public surface (safe columns,
   live creators only). This is exactly the documented trade-off the linter exists
   to surface — ours is a justified use. Alternative that would silence it, if
   Phase 2 prefers: make the view `security_invoker = true`, add an RLS policy on
   `connected_accounts` allowing public SELECT of live creators' rows, and use
   **column-level grants** so `anon`/`authenticated` can only select the safe
   columns (never `token_ref`).
2. **WARN `multiple_permissive_policies`** on `offerings` and `portfolio_items`
   (SELECT): the owner-manage `for all` policy overlaps the public-read policy.
   Performance-only at our scale; fix in Phase 2 by splitting the `for all`
   policies into explicit insert/update/delete policies.
3. **WARN `extension_in_public` (citext)**: carry-forward item; fix before first
   hosted push (see B, last section).

## D. Security posture notes (Supabase-specific, verified current)

- Signup role comes from `raw_user_meta_data`, but it is **never trusted for
  authorization**: the DB trigger whitelists creator/brand at insert, the role
  column is locked against user updates (column-level grants), and all
  authorization reads `public.profiles.role` — not JWT metadata claims.
- All five `security definer` functions set `search_path = ''`; the only
  directly-callable one (`transition_deal`) has `execute` revoked from `public`
  and granted only to `authenticated` + `service_role`. Trigger functions are
  not directly callable.
- The service-role/secret key must never appear in a `NEXT_PUBLIC_` env var.
