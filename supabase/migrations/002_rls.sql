-- ══════════════════════════════════════════════════════════════
--  LITTLECHEF · 002_rls.sql
--  Row Level Security: ogni utente vede e tocca SOLO i dati del
--  proprio ristorante. Nessuna policy permissiva, zero eccezioni.
-- ══════════════════════════════════════════════════════════════

alter table public.restaurants  enable row level security;
alter table public.dishes       enable row level security;
alter table public.pantry_items enable row level security;
alter table public.preparations enable row level security;
alter table public.fixed_costs  enable row level security;
alter table public.sections     enable row level security;

-- ── RESTAURANTS: solo le proprie righe ─────────────────────────
create policy "restaurants_select_own" on public.restaurants
  for select using (owner_id = auth.uid());

create policy "restaurants_insert_own" on public.restaurants
  for insert with check (owner_id = auth.uid());

create policy "restaurants_update_own" on public.restaurants
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "restaurants_delete_own" on public.restaurants
  for delete using (owner_id = auth.uid());

-- ── Helper: condizione riusabile per le tabelle figlie ─────────
-- (subquery diretta, nessuna funzione: più semplice da verificare)

-- ── DISHES ─────────────────────────────────────────────────────
create policy "dishes_select_own" on public.dishes
  for select using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

create policy "dishes_insert_own" on public.dishes
  for insert with check (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

create policy "dishes_update_own" on public.dishes
  for update using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()))
  with check (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

create policy "dishes_delete_own" on public.dishes
  for delete using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

-- ── PANTRY_ITEMS ───────────────────────────────────────────────
create policy "pantry_select_own" on public.pantry_items
  for select using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

create policy "pantry_insert_own" on public.pantry_items
  for insert with check (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

create policy "pantry_update_own" on public.pantry_items
  for update using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()))
  with check (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

create policy "pantry_delete_own" on public.pantry_items
  for delete using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

-- ── PREPARATIONS ───────────────────────────────────────────────
create policy "preparations_select_own" on public.preparations
  for select using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

create policy "preparations_insert_own" on public.preparations
  for insert with check (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

create policy "preparations_update_own" on public.preparations
  for update using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()))
  with check (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

create policy "preparations_delete_own" on public.preparations
  for delete using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

-- ── FIXED_COSTS ────────────────────────────────────────────────
create policy "fixed_costs_select_own" on public.fixed_costs
  for select using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

create policy "fixed_costs_insert_own" on public.fixed_costs
  for insert with check (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

create policy "fixed_costs_update_own" on public.fixed_costs
  for update using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()))
  with check (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

create policy "fixed_costs_delete_own" on public.fixed_costs
  for delete using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

-- ── SECTIONS ───────────────────────────────────────────────────
create policy "sections_select_own" on public.sections
  for select using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

create policy "sections_insert_own" on public.sections
  for insert with check (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

create policy "sections_update_own" on public.sections
  for update using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()))
  with check (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

create policy "sections_delete_own" on public.sections
  for delete using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));
