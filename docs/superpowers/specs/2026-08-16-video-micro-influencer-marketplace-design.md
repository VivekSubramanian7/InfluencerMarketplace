# Video Micro-Influencer Marketplace — System Design & Plan

## Context

Build a Passionfroot-style platform scoped to **video micro-influencers** (TikTok, YouTube, Instagram Reels). Research into Passionfroot, Collabstr, Insense, and the UGC market identified:

**Loved (keep):** bookable creator storefronts with productized offerings; verified auto-updating media kits; escrow payments (brand funds upfront, released on delivery); pipeline view replacing DM/email chaos.

**Hated (avoid):** "plumbing, not demand" (no brand discovery); commissions taken from creators; creator-side fees (scam signal); fake/unvetted participants; weak analytics; buggy UX; performance-based pay.

**Decisions made with user:**
- Model: creator storefronts + brand-facing discovery directory (fixes the demand gap)
- Platforms: TikTok + YouTube + IG Reels
- Monetization: none in MVP (design fee-ready: brand-side fee later; never charge creators)
- Payments: escrow via Stripe Connect as the preferred mode, but deals must also flow end-to-end without escrow (off-platform payment mode) since Stripe availability may be a problem for MVP
- Stats: API-verified from day one (YouTube live at launch; TikTok/IG code-complete behind flags pending their app reviews, "verification pending" state until approved)
- Bar: launchable MVP for real users
- Stack: Next.js + Supabase + Stripe, plus background jobs (approach B)

Greenfield project in D:\InfluencerMarketplace (empty directory, not yet a git repo).

## Requirements

**Functional:** creator onboarding + platform OAuth verification; public storefronts with productized offerings; brand discovery directory with filters; booking with structured briefs; deal state machine with anti-ghosting timers; optional Stripe escrow; per-deal messaging; two-sided reviews; transactional email; admin panel (users, deals, disputes, reports).

**Non-functional:**
- Scale target: MVP — ~1–2k creators, ~10k monthly brand visits, tens of concurrent deals. Everything fits comfortably in Supabase Pro + Vercel hobby/pro. No premature scaling work.
- Ops: solo builder — minimize moving parts; managed services only; no self-hosted infra.
- Cost: near-zero at idle.
- Security: RLS on every table; OAuth tokens encrypted at rest, never sent to client; card data never touches our servers (Stripe Checkout → SAQ-A); webhook signature verification.
- Availability: best-effort; graceful degradation (stale stats shown with last-verified date, escrow unavailable → off_platform mode).

**Constraints:** solo builder; TikTok/Meta developer app reviews are external, multi-week dependencies; chosen stack fixed (Next.js + Supabase + Stripe).

## High-level architecture

```
                ┌────────────────────────── Vercel ──────────────────────────┐
 Browser ─────► │ Next.js App Router (TS)                                    │
 (creator /     │  • RSC pages: storefront /c/[handle], directory /discover  │
  brand /       │  • Server Actions: all mutations (booking, transitions…)   │
  admin)        │  • Route handlers: /api/webhooks/stripe,                   │
                │                    /api/oauth/[platform]/callback          │
                └───────┬───────────────┬────────────────┬───────────────────┘
                        │               │                │
                        ▼               ▼                ▼
                ┌─ Supabase ─────────────────────┐  ┌─ Stripe ────────────┐
                │ Postgres (+RLS)   Auth          │  │ Checkout (escrow)   │
                │ Storage (media)   pgmq queues   │  │ Connect Express     │
                │ pg_cron schedules Edge Functions│  │ Transfers / Refunds │
                └───────┬────────────────────────┘  └─────────────────────┘
                        │ Edge Functions (workers) call out to:
                        ▼
                YouTube Data API · TikTok API (flagged) · IG Graph API (flagged) · Resend (email)
```

**Module boundaries** (each independently understandable/testable):

| Module | Purpose | Key artifact |
|---|---|---|
| auth/profiles | Supabase auth, creator vs brand roles, onboarding | RLS policies, `profiles` |
| storefront | Public creator page, offerings, portfolio | ISR pages, tag revalidation |
| discovery | Directory, filters, Postgres FTS search | indexed queries |
| deals | State machine — pure TS, no I/O | `lib/deals/machine.ts` |
| payments | Stripe adapter: checkout, transfer, refund, webhooks | `lib/payments/stripe.ts` |
| verification | `PlatformConnector` interface + 3 impls + refresh jobs | `lib/platforms/*` |
| messaging/notifications | Per-deal thread, email events via queue | `emails` queue |
| admin | User/deal/dispute management | admin routes, role gate |

## Data model (Postgres, all tables RLS'd)

- `profiles` — user_id (PK→auth.users), role (creator|brand|admin), name, avatar
- `creator_profiles` — handle (unique, citext), bio, niches text[], country, languages text[], status (draft|live|suspended)
- `connected_accounts` — creator_id, platform (youtube|tiktok|instagram), platform_handle, token_ref (Supabase Vault secret id — tokens never in table), follower_count, avg_views, engagement_rate, last_synced_at, verification_status (verified|pending|stale|failed)
- `offerings` — creator_id, type (dedicated_video|integration|short_form_post|ugc_video), title, description, price_cents, currency, turnaround_days, revision_limit, active
- `portfolio_items` — creator_id, media/URL, caption
- `brand_profiles` — company, website, logo
- `deals` — brand_id, creator_id, offering snapshot (type/title/price_cents copied at booking), status, payment_mode (escrow|off_platform), revision_count, due_date, per-transition timestamps (funded_at, accepted_at, …)
- `briefs` — deal_id, structured fields (goals, product, talking points, links), asset file refs
- `deal_events` — append-only audit log: deal_id, actor, from_status, to_status, metadata jsonb
- `messages` — deal_id, sender_id, body, attachments
- `payments` — deal_id, stripe_payment_intent_id, amount_cents, status
- `payouts` — deal_id, stripe_transfer_id, amount_cents, status
- `stripe_events` — event_id (unique) for webhook idempotency
- `reviews` — deal_id, author side, rating, text (both sides, unlocked at completed)
- `reports` — reporter, subject, reason, admin resolution

Integrity: deal status transitions happen only through a single `transition_deal()` Postgres function (security definer) that validates the edge against the transition table, writes `deals` + `deal_events` atomically, and rejects illegal jumps — the DB enforces the state machine, not just app code.

## API contracts

Mutations are Next.js Server Actions (typed, co-located); public/webhook surfaces are route handlers:

- `POST /api/webhooks/stripe` — signature-verified; inserts into `stripe_events` (unique event_id = idempotency), enqueues to pgmq `stripe_events` queue, returns 200 fast; worker processes async.
- `GET /api/oauth/[platform]/start` → redirect; `GET /api/oauth/[platform]/callback` — exchanges code, stores tokens in Vault, creates `connected_accounts` row, enqueues initial stats fetch.
- Server actions (representative): `createOffering`, `bookOffering(offeringId, brief)` (creates deal + Stripe Checkout session in escrow mode), `transitionDeal(dealId, action)` (thin wrapper over `transition_deal()` RPC), `sendMessage`, `submitReview`.

## Deal state machine (core domain)

`requested → [funded] → accepted → in_production → submitted → (revision ⇄ submitted) → published → completed`, with `cancelled` and `disputed` reachable from pre-completed states. Cancellation policy (human ruling 2026-08-17): brand may cancel (refund in escrow mode) from requested/funded/accepted/in_production; creator may decline pre-accept and cancel through in_production; after preview submission, exit is dispute-only (admin resolves).

**Payment mode per deal: `escrow` or `off_platform`.** Escrow is preferred but never a blocker (user decision: Stripe availability may be a problem for MVP). If the creator has a ready Connect account and Stripe is configured, booking goes through Stripe Checkout and the `funded` gate applies. Otherwise the deal is created in `off_platform` mode: `funded` is skipped (requested → accepted), the deal page shows a clear "payment handled outside the platform" banner to both sides, and refund/payout steps are no-ops. Brands can record "marked as paid" for tracking. All logic branches on `payment_mode`, so enabling escrow later requires no flow changes.

- **requested**: brand books offering + submits brief; escrow mode: Checkout session; funds captured → `funded` (via webhook)
- **accepted**: creator accepts within 72h, else auto-cancel (+ full refund in escrow mode) — worker timer
- **submitted**: creator uploads preview/link; brand may request revisions up to the offering's `revision_limit`
- **published**: creator posts publicly + submits live URL
- **completed**: brand approves, or auto-approves after 5 days (worker timer) → Transfer to creator (escrow mode only), reviews unlocked
- Disagreements → `disputed` → admin resolves (refund or release)

## Queues, jobs, and timers

- pgmq queues: `stats_refresh`, `emails`, `stripe_events`
- pg_cron: nightly scan enqueueing stale `connected_accounts` for refresh; every-15-min deal-timer sweep (accept deadlines, auto-approve windows) calling `transition_deal()` — all sweeps idempotent, driven by status + timestamps, safe to re-run
- Edge Functions consume queues; pgmq visibility timeout gives retry; after N failures → dead-letter + surfaced in admin

## Caching strategy

- Storefronts + directory pages: Next.js ISR (revalidate ~300s) + tag-based revalidation on profile/offering writes — public pages never hit Postgres per request
- Platform stats: cached in `connected_accounts`, refreshed nightly; UI always shows `last_synced_at`; never silently show dead stats
- No Redis/edge KV in MVP — Postgres + ISR covers the load target

## Error handling

- Stripe: signature verification, event-id idempotency, queued processing; payment failure at booking → deal stays `requested`, expires
- OAuth refresh failure → account `stale`, creator emailed, badge shows last-verified date
- Escrow unavailable (no Connect account / Stripe down) → booking degrades to `off_platform` mode, clearly labeled
- Every worker job idempotent; dead-letter queue visible in admin

## Scale & reliability (right-sized for MVP)

- Load estimate: <10 RPS peak; Postgres FTS + trigram indexes handle directory search to ~100k creators before dedicated search is worth it
- Monitoring: Sentry (Next.js + Edge Functions), Supabase logs/advisors, Stripe dashboard; alert = Sentry email
- Revisit as it grows: dedicated search (Typesense/Meilisearch) past ~100k creators; move stats refresh to per-platform rate-limit-aware schedulers; read replicas only if directory reads dominate; in-app realtime messaging (Supabase Realtime) if email-notified threads feel slow

## Explicit trade-offs

| Decision | Chose | Cost accepted |
|---|---|---|
| Jobs runtime | pgmq/pg_cron in Supabase | less tooling than a real queue service; fine at MVP scale, swap later |
| Escrow optional | payment_mode branch | two code paths to test; but Stripe can't block launch |
| Mutations | Server Actions over REST/tRPC | weaker external API story; none needed for MVP |
| Search | Postgres FTS | no typo-tolerance/facet speed of dedicated search; fine <100k rows |
| State machine in DB function | strong integrity | logic split TS (UX) + SQL (enforcement); mitigated by generating both from one transition table |
| TikTok/IG flagged | launch on YouTube verification only | some creators "pending" at launch; external reviews can't gate shipping |

## Architecture Decision Records

### ADR-001: Application platform — Next.js on Vercel + Supabase
**Status:** Accepted (user decision) · **Date:** 2026-08-16
**Context:** Solo builder, launchable MVP, existing Supabase tooling in the user's environment.
**Options:** (A) Next.js + Supabase + Vercel; (B) Next.js + custom Node API + own Postgres; (C) T3 stack.
**Decision:** A. Managed auth/DB/storage/RLS eliminates the largest categories of solo-builder work; B and C add infrastructure and auth surface without MVP benefit.
**Consequences:** easier — auth, storage, RLS, hosting; harder — vendor coupling (acceptable: Supabase is plain Postgres underneath, exit path exists); revisit — only if RLS-centric authorization becomes limiting.

### ADR-002: Background jobs — pgmq + pg_cron in Supabase, no external worker service
**Status:** Accepted (user picked approach B: app + background jobs) · **Date:** 2026-08-16
**Context:** Need nightly stats refresh, deal timers, async webhook processing, email retry.
**Options:** (A) Vercel cron hitting API routes; (B) pgmq + pg_cron + Edge Functions inside Supabase; (C) separate hosted worker (Railway/Fly) with BullMQ/Redis.
**Decision:** B. Queues and schedules live next to the data with transactional enqueue; no new deployment target or Redis to operate. A has weak retry semantics and function timeout limits; C is the scale-up path, not the MVP path.
**Consequences:** easier — one platform to operate, transactional job enqueue; harder — less observability tooling than BullMQ (mitigate: dead-letter queue surfaced in admin); revisit — move to C if job volume or long-running jobs outgrow Edge Function limits.

### ADR-003: Payments — Stripe Connect Express, separate charges & transfers, escrow optional per deal
**Status:** Accepted (user decision: escrow must not block MVP) · **Date:** 2026-08-16
**Context:** Escrow was the #1 loved feature in research, but the user's Stripe account availability is uncertain; platform takes no fee in MVP.
**Options:** (A) Destination charges (funds route to creator at charge time); (B) Separate charges & transfers (charge platform at booking, transfer on approval); (C) No payments in MVP.
**Decision:** B, with a per-deal `payment_mode` (escrow|off_platform) so every flow also works with zero Stripe configuration. B is the only Stripe pattern that gives true hold-and-release; A cannot hold funds pending approval.
**Consequences:** easier — real escrow, refunds before transfer are simple, `application_fee`-ready; harder — two payment paths to test; platform balance briefly holds client funds (deals complete in days–weeks, well inside Stripe's holding expectations); revisit — negative-balance/dispute liability policy once volume is real.

### ADR-004: Deal-state integrity — single `transition_deal()` Postgres function
**Status:** Accepted · **Date:** 2026-08-16
**Context:** The deal state machine is the product's core invariant; timers, server actions, and admin tools all mutate it.
**Options:** (A) Transitions enforced only in TypeScript; (B) DB-enforced via one security-definer function validating a transition table, writing `deals` + `deal_events` atomically.
**Decision:** B. Every caller (server action, cron sweep, admin) goes through one choke point; illegal jumps are impossible regardless of app bugs; audit log can never drift from state.
**Consequences:** easier — correctness, auditability, idempotent timer sweeps; harder — logic exists in TS (for UX affordances) and SQL (for enforcement) — mitigate by generating both from one shared transition-table definition; revisit — nothing foreseeable.

### ADR-005: Platform verification — one `PlatformConnector` interface, staged rollout behind flags
**Status:** Accepted (user decision: API-verified from day one) · **Date:** 2026-08-16
**Context:** Verified stats are a top differentiator, but TikTok and Meta app reviews are external multi-week dependencies; YouTube (Google OAuth) is fast.
**Options:** (A) Launch blocked on all three verifications; (B) Shared interface, YouTube live at launch, TikTok/IG code-complete behind feature flags with "verification pending" creator states.
**Decision:** B. Launch date must not depend on third-party review queues; the shared abstraction guarantees no throwaway work when flags flip on.
**Consequences:** easier — shipping, adding future platforms (Twitch); harder — some creators show "pending" at launch (honest labeling beats fake numbers per research); action — user must create TikTok + Meta developer apps and submit for review early, in parallel with development.

### ADR-006: Directory search — Postgres FTS + trigram, no dedicated search service
**Status:** Accepted · **Date:** 2026-08-16
**Context:** Brand discovery needs filters (platform, niche, followers, price) + text search over ~1–2k creators at MVP.
**Options:** (A) Postgres FTS + GIN/trigram indexes; (B) Typesense/Meilisearch/Algolia.
**Decision:** A. At this cardinality Postgres is instant and adds zero infrastructure; filters are plain indexed columns.
**Consequences:** easier — one datastore, RLS applies to search; harder — no typo tolerance or instant facets; revisit — B past ~100k creators or when search UX becomes a conversion lever.

### Architecture review — flagged risks

1. **Stripe funds-holding**: separate charges & transfers means client money sits in the platform balance between funding and approval. Fine at MVP timescales (days–weeks), but write clear cancellation/refund terms into the ToS page, and revisit liability policy before real volume.
2. **Two payment paths** (`escrow` / `off_platform`) is the design's main complexity tax — contained by making the state machine transition table the single source of truth and unit-testing both modes edge-for-edge.
3. **Edge Function limits** (execution time, cold starts) bound how heavy stats-refresh jobs can get; per-account jobs are small HTTP calls, so this only bites at large creator counts — ADR-002's revisit clause covers it.
4. **Off-platform leakage**: off_platform mode makes it easy to transact outside the platform entirely. Irrelevant while there are no fees (MVP), but becomes the core business risk when monetization lands — the future fee design must make escrow the obviously-better deal, not fight leakage with restrictions creators hate (per research).

## Testing

- **Unit (Vitest)**: deal state machine (every legal/illegal edge, both payment modes), escrow amount math, platform stat normalization
- **Integration**: RLS policy tests (creator can't read others' deals, brand can't edit offerings, etc.); `transition_deal()` rejects illegal jumps
- **E2E (Playwright)**: signup → storefront → discovery → book (off_platform AND Stripe test mode) → accept → submit → approve → payout

## MVP scope cuts (explicit non-goals)

- No monetization/fees (fee-ready schema only); no performance-based pricing, ever
- Productized offerings only — no custom/ambassador deals in v1
- No mobile app; responsive web only; no in-app realtime chat (thread + email notify)
- TikTok/IG verification ships dark behind flags until app reviews pass (user must create TikTok/Meta developer apps + submit — external dependency)

## Phasing (for the implementation plan)

1. Foundation: repo, Next.js + Supabase setup, auth, roles, schema + RLS + `transition_deal()`
2. Creator storefronts: onboarding, offerings, portfolio, public page (ISR)
3. Discovery: directory + filters + FTS search
4. Deals: booking, briefs, state machine (off_platform mode first so the full flow works without Stripe), messaging; then Stripe escrow layered on as the preferred mode
5. Verification: `PlatformConnector`, YouTube OAuth + stats, pgmq/pg_cron jobs, TikTok/IG behind flags
6. Launch readiness: reviews, admin panel, emails, empty states, legal pages, e2e tests

## Verification (how we'll know it works)

- E2E suite passes: full happy path in both payment modes (Stripe test mode for escrow)
- Manual: creator + brand accounts complete one off_platform deal and one escrow test-mode deal, including refund and auto-approve paths
- RLS tests pass; Supabase advisors/lint clean; Sentry wired and reporting
