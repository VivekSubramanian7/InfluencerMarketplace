# Manual Test Script (local)

Server: http://localhost:3000 · All passwords: `demo1234`

| Account | Role | Use for |
|---|---|---|
| demo-creator@test.local | creator | storefront + selling side (has a live storefront: /c/mayafilms) |
| demo-brand@test.local | brand | discovery + buying side |
| demo-admin@test.local | admin | /admin panel |

**Tip:** use a normal window for one role and an incognito/private window for the
other so you can play both sides of a deal at once.

## 1. Public pages (no login)
- [ ] `/` — landing renders, Get started / Log in work
- [ ] `/c/mayafilms` — storefront shows bio, "Verification pending" panel, 2 offerings with Book buttons, portfolio link
- [ ] `/c/nobodyhere` — 404
- [ ] `/deals` while logged out → bounced to login; after logging in you land back on /deals (return-to)

## 2. Creator side (demo-creator)
- [ ] Log in → lands on Dashboard, checklist shows 4/4
- [ ] Edit profile bio → Save → storefront reflects it (may take a refresh)
- [ ] Add a third offering; hide it; confirm hidden one absent from storefront
- [ ] Add + remove a portfolio link; try `javascript:alert(1)` → friendly error
- [ ] Unpublish → /c/mayafilms 404s → Republish

## 3. Brand side (demo-brand)
- [ ] Log in → lands on Discover; mayafilms appears
- [ ] Filters: niche `tech` → found; niche `dance` → empty state; price Min 200 → only the $450 offering's creator
- [ ] Open storefront → Book the 60s vertical → fill the brief → lands on the deal page with the off-platform payment banner

## 4. The deal (both windows)
- [ ] Creator: /deals shows it under "Action needed" → open → Accept → Start production
- [ ] Both sides: exchange messages
- [ ] Creator: Submit preview (any https:// link)
- [ ] Brand: Request changes → creator resubmits → note revision counter 1/1; a second "Request changes" should error (limit)
- [ ] Creator: Mark as published (any https:// link)
- [ ] Brand: Mark as paid (button disappears after) → Approve & complete
- [ ] Both: leave reviews (1 each; a second attempt shows "You already reviewed this deal")
- [ ] /c/mayafilms now shows the brand's review + ★ average

## 5. Dispute + admin (book a second deal first)
- [ ] Brand books again; creator accepts; brand clicks Open dispute
- [ ] demo-admin: /admin shows the disputed deal → open → Release or Refund → status updates; deal page for both users reflects it
- [ ] Any user: Report a problem from a deal → admin sees it in Open reports → resolves with a note
- [ ] Admin: Suspend mayafilms → storefront 404s, gone from Discover, creator's dashboard shows suspended → Unsuspend (returns to draft; creator republishes)
- [ ] demo-brand visiting /admin → bounced to /

## 6. Sad paths worth poking
- [ ] Sign up a brand-new account of each role from scratch
- [ ] Price field: `abc`, `0`, `0.50` → friendly errors
- [ ] Handle: `ab`, `has space`, duplicate `mayafilms` → friendly errors
- [ ] Wrong-role access: creator → /discover works (browsing allowed), brand → /dashboard bounced to /

## Anti-ghosting timers (simulated — they normally fire on their own every 15 min)
Backdate a fresh un-accepted deal 73h, then run the sweep:
```bash
docker exec supabase_db_InfluencerMarketplace psql -U postgres -d postgres -c "update deals set requested_at = now() - interval '73 hours' where status='requested'; select public.run_deal_timers();"
```
The deal should flip to cancelled.

## Cleanup when done
```bash
docker exec supabase_db_InfluencerMarketplace psql -U postgres -d postgres -c "delete from auth.users where email like 'demo-%@test.local';"
```
