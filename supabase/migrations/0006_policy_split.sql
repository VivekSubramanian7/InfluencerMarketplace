-- Advisor fix (Phase 1 carry-forward): the "manage own" FOR ALL policies on
-- offerings/portfolio_items each add a second permissive SELECT policy on top
-- of the public-read policy. Split into per-operation policies; SELECT stays
-- solely with the public-read policies. Access semantics are unchanged:
-- owners could already see their own rows via the public policies
-- ("active = true OR owner" on offerings; unconditional on portfolio_items).

drop policy "creators manage own offerings" on public.offerings;
create policy "creators insert own offerings"
  on public.offerings for insert
  with check ((select auth.uid()) = creator_id);
create policy "creators update own offerings"
  on public.offerings for update
  using ((select auth.uid()) = creator_id)
  with check ((select auth.uid()) = creator_id);
create policy "creators delete own offerings"
  on public.offerings for delete
  using ((select auth.uid()) = creator_id);

drop policy "creators manage own portfolio" on public.portfolio_items;
create policy "creators insert own portfolio"
  on public.portfolio_items for insert
  with check ((select auth.uid()) = creator_id);
create policy "creators update own portfolio"
  on public.portfolio_items for update
  using ((select auth.uid()) = creator_id)
  with check ((select auth.uid()) = creator_id);
create policy "creators delete own portfolio"
  on public.portfolio_items for delete
  using ((select auth.uid()) = creator_id);
