# Deployment — Vercel + hosted Supabase

Status: prepared 2026-08-18. Production `next build` passes (18 routes, proxy
middleware detected). All schema state lives in `supabase/migrations/0001–0013`
— including the generated state-machine seed (0005) and pg_cron timer sweep
(0011) — so a single `db push` reproduces the entire backend. No seed.sql:
demo accounts (`*@test.local`) are local-only and will not exist in production.

## Phase A — Accounts (only you can do these)

1. **Supabase**: create a project at https://supabase.com/dashboard (pick the
   region nearest your users; save the database password).
2. **Vercel**: account at https://vercel.com. Install the CLI: `npm i -g vercel`.
3. **GitHub (recommended)**: create a repo and push `master`. Vercel's Git
   integration then gives auto preview deploys per branch — better than
   CLI-only deploys. (This repo currently has no remote.)

## Phase B — Supabase go-live

```bash
npx supabase login                      # opens browser
npx supabase link --project-ref <ref>   # ref from the project's dashboard URL
npx supabase db push                    # applies 0001..0013 in order
npx supabase migration list --linked    # verify all 13 applied
```

Then in the dashboard:

- **Auth → URL Configuration**: set Site URL to the production domain once
  known (e.g. `https://<app>.vercel.app`); add `http://localhost:3000` and the
  Vercel preview URLs to Additional Redirect URLs.
- **Auth → Email**: the built-in SMTP is rate-limited (a few emails/hour) and
  fine only for early testing. Custom SMTP (Resend) is the planned follow-up.
  If email confirmation is on (hosted default), signups must confirm before
  first login — decide whether to keep that for MVP.
- **Settings → API**: copy the Project URL and the anon/publishable key for
  Phase C. The service_role/secret key is NOT needed by the app code today —
  don't put it in Vercel until something uses it.
- **Integrations → Data API settings**: confirm `public` schema is exposed.
  (Since 2026-04-28 new tables aren't auto-exposed; our migrations carry
  explicit grants for `anon`/`authenticated`, which is the required opt-in.)
- **Verify pg_cron**: SQL editor → `select jobname, schedule from cron.job;`
  should show `deal-timers` every 15 min.
- **Run advisors**: `npx supabase db advisors` (or dashboard Advisors page);
  expect at most the known cosmetic warning about `citext` living in `public`.

## Phase C — Vercel

Preferred: dashboard → Add New Project → import the GitHub repo (framework
auto-detected as Next.js; no vercel.json needed). CLI equivalent:

```bash
vercel login
vercel link          # create the Vercel project
```

Environment variables (Production AND Preview):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/publishable key from Phase B |

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# repeat with `preview` as the target

vercel               # PREVIEW deploy first — isolated URL, no users affected
# smoke test the preview, then, explicitly:
vercel --prod
```

After the first production deploy, go back to Supabase Auth URL Configuration
and set the real domain as Site URL.

## Post-deploy smoke test (both of us)

1. `/` renders; `/discover` returns the (empty) directory without errors.
2. Sign up a creator → onboarding → publish storefront → `/c/<handle>` is live.
3. Sign up a brand → book an offering (off_platform mode) → accept → full deal
   loop → review.
4. `vercel logs <url> --level error` after ~1h: expect clean.

## Known non-blockers, recorded

- **Timer funded-clock bug in 0011** (expire sweep keys off `requested_at`
  even for funded deals): dormant while everything is off_platform mode;
  MANDATORY fix before the Stripe escrow phase.
- **Platform OAuth verification** (YouTube/TikTok/Meta apps) is not deployed;
  storefronts honestly show "Verification pending". Needs developer apps
  created under your accounts.
- **Emails**: no transactional email provider wired yet (Resend planned);
  auth emails use Supabase built-in SMTP limits.
- **AGENTS.md churn**: `next dev` rewrites a block into AGENTS.md; commit it
  with your work when it reappears, never strip it from diffs.
