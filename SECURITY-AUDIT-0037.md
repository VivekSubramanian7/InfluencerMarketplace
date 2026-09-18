# Security & Business Rule Audit: `fix/brand-flow-robustness`

**Date**: 2026-09-18
**Scope**: Migration 0037 + all server actions on branch `fix/brand-flow-robustness`
**Method**: App-layer limits compared against DB-layer enforcement (RPCs, triggers, RLS, CHECK constraints)

---

## Security Vulnerabilities

### VULN-1: `create_deal()` RPC — no caller identity validation

- **File**: `supabase/migrations/0037_brand_flow_robustness.sql:9-97`
- **Severity**: HIGH
- **Type**: Authorization bypass
- **Description**: `create_deal()` is a `security definer` function granted to `authenticated` that accepts `p_brand_id` as a caller-supplied parameter but never validates `auth.uid() = p_brand_id`. It also sets `clipline.internal` to bypass insert triggers.
- **Exploit**: Any authenticated user (including creators) calls `supabase.rpc('create_deal', { p_brand_id: '<victim_brand>', p_creator_id: '<any_creator>', p_offering_id: '<valid_offering>', p_price_cents: 0, p_brief: '{}', p_source: 'exploit', p_initial_status: 'accepted' })`. Creates a deal impersonating the victim brand in `accepted` status with an auto-created conversation.
- **Impact**: Privilege escalation — any user can create deals on behalf of any brand.
- **Fix**: Add `if auth.uid() is distinct from p_brand_id then raise exception 'not authorized'; end if;` after line 29.

### VULN-2: `accept_campaign_application()` — no blocklist check before deal creation

- **File**: `supabase/migrations/0037_brand_flow_robustness.sql:106-170`
- **Severity**: MEDIUM
- **Type**: Authorization bypass
- **Description**: The PR adds blocklist enforcement to `invite_to_campaign()` and the conversation insert trigger, but `accept_campaign_application()` does not check the blocklist before calling `create_deal()`. Since `create_deal()` is `security definer` and sets `clipline.internal`, the conversation insert bypasses the trigger's blocklist check.
- **Exploit**: Brand blocks Creator A. Creator A had a pending application from before the block. Brand accepts the application. A deal + conversation is created with the blocked creator.
- **Impact**: Violates blocklist intent — blocked creators end up in active deals.
- **Fix**: Add blocklist check after the `v_app.status <> 'pending'` guard: `if exists (select 1 from public.brand_blocklist b where b.brand_id = v_uid and b.creator_id = v_app.creator_id) then raise exception 'This creator is on your blocklist'; end if;`

---

## Business Rule Enforcement Gaps

### GAP-1: Invite batch cap — app only

- **App limit**: `app/campaigns/[id]/invite-actions.ts:17` — `.slice(0, 5)` caps at 5 creators per form submission
- **DB enforcement**: MISSING — `invite_to_campaign()` RPC accepts one creator at a time with no aggregate cap
- **Bypass**: Call the RPC in a loop with hundreds of creator IDs
- **Impact**: Spam — brand can mass-invite every live creator on the platform

### GAP-2: Reachout batch cap — app only

- **App limit**: `app/discover/actions.ts:22` — `.slice(0, 20)` caps at 20 creators per reachout
- **DB enforcement**: MISSING — `conversations` INSERT has no batch-size constraint
- **Bypass**: Submit FormData with >20 `creator_id` entries, or call `.from('conversations').insert()` directly in a loop
- **Impact**: Spam — brand can open conversations with unlimited creators

### GAP-3: Product count cap — app only

- **App limit**: `app/brand/actions.ts:131` — `.slice(0, 12)` caps ingested products at 12
- **DB enforcement**: MISSING — `brand_products` table has no count constraint or trigger
- **Bypass**: Call `.from('brand_products').insert()` directly, unlimited times
- **Impact**: Data bloat — brand can create unlimited products

### GAP-4: Campaign budget/offering_type change guard — app only

- **App limit**: `app/campaigns/actions.ts:171-182` — blocks budget/offering_type changes when pending applications exist
- **DB enforcement**: MISSING — no trigger on `campaigns` UPDATE checks for pending applications
- **Mitigating factor**: `authenticated` role lacks UPDATE grant on `campaigns` table, so direct Supabase client calls fail at the grant level. Only exploitable if grants change.
- **Impact**: If grants are ever widened, brand could bait-and-switch applicants by changing budget after applications are submitted

### GAP-5: Product deletion guard — app only

- **App limit**: `app/brand/actions.ts:235-239` — checks for active campaigns before deleting a product
- **DB enforcement**: MISSING — no trigger blocks deletion; `campaigns.product_id` has `ON DELETE SET NULL`
- **Bypass**: Call `.from('brand_products').delete().eq('id', productId).eq('brand_id', userId)` directly
- **Impact**: Data inconsistency — active campaign loses its product reference (nulled out)

### GAP-6: Company name required — app only

- **App limit**: `app/brand/actions.ts:52-54` — requires non-empty company name
- **DB enforcement**: MISSING — `brand_profiles.company` is nullable (migration 0001:46), no NOT NULL or CHECK
- **Bypass**: Call `.from('brand_profiles').upsert({ user_id: id, company: null })` directly
- **Impact**: Data inconsistency — brand profile without company name, breaks slug generation and display

### GAP-7: Age range cross-field validation — app only

- **App limit**: `app/brand/actions.ts:206` — checks `ageMin <= ageMax`
- **DB enforcement**: PARTIAL — individual range CHECKs exist (`between 13 and 100`) but no cross-column CHECK ensuring `min <= max`
- **Bypass**: Insert product with `target_age_min=100, target_age_max=13`
- **Impact**: Nonsensical targeting data, broken filtering

### GAP-8: `deals.price_cents` — no range constraint

- **App limit**: `parsePriceCents()` enforces $1–$1M range at app layer
- **DB enforcement**: MISSING — `deals.price_cents` is `bigint not null` with no CHECK constraint (migration 0003:14)
- **Note**: `offers.price_cents` has `CHECK (between 100 and 100000000)` but deals does not
- **Bypass**: `create_deal()` RPC passes `p_price_cents` straight through to the insert
- **Impact**: Deals created at $0 or absurdly high amounts; financial data corruption

### GAP-9: `offers.campaign_id` updatable without trigger validation

- **Introduced by**: `supabase/migrations/0037_brand_flow_robustness.sql:286` — `grant update (campaign_id) on table public.offers to authenticated`
- **DB enforcement**: MISSING — `validate_offer_update()` trigger (migration 0017:205-236) blocks changes to `conversation_id`, `offering_id`, `price_cents`, `note`, `created_at` but does not block changes to `campaign_id`
- **Bypass**: Any conversation participant calls `.from('offers').update({ campaign_id: '<any_campaign>' }).eq('id', offerId)`
- **Impact**: Data corruption — offer attribution can be rewritten to point at any campaign

---

## Summary Table

| # | Type | Location | DB Enforced? | Impact |
|---|------|----------|-------------|--------|
| VULN-1 | Auth bypass | `create_deal()` | No | Impersonate any brand |
| VULN-2 | Auth bypass | `accept_campaign_application()` | No | Blocklist violated |
| GAP-1 | Batch cap | invite-actions.ts:17 | No | Spam |
| GAP-2 | Batch cap | discover/actions.ts:22 | No | Spam |
| GAP-3 | Count cap | brand/actions.ts:131 | No | Data bloat |
| GAP-4 | State guard | campaigns/actions.ts:171 | No (mitigated by grant) | Bait-and-switch |
| GAP-5 | Delete guard | brand/actions.ts:235 | No | Orphaned references |
| GAP-6 | Required field | brand/actions.ts:52 | No | Broken display/slugs |
| GAP-7 | Cross-field | brand/actions.ts:206 | Partial | Nonsensical data |
| GAP-8 | Range check | parsePriceCents | No | Financial corruption |
| GAP-9 | Column guard | 0037:286 | No | Attribution corruption |
