-- ══════════════════════════════════════════════════════════════
--  LITTLECHEF · 004_message_limit.sql
--  Limite messaggi Sous Chef per ristorante/giorno.
--  Reset automatico a mezzanotte (Europe/Rome): la chiave è la data
--  locale, quindi ogni nuovo giorno riparte da 0. Nessun cron.
-- ══════════════════════════════════════════════════════════════

create table if not exists public.message_counters (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  day           date not null,
  count         integer not null default 0,
  primary key (restaurant_id, day)
);

alter table public.message_counters enable row level security;

-- L'utente può leggere il proprio contatore (per mostrare "quante ne restano")
create policy "mc_select_own" on public.message_counters
  for select using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

-- Incremento atomico + controllo limite. SECURITY DEFINER per gestire il
-- contatore, ma sempre limitato al ristorante del chiamante (auth.uid()).
create or replace function public.increment_message_count(p_limit integer default 100)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid   uuid;
  v_day   date := (now() at time zone 'Europe/Rome')::date;
  v_count integer;
begin
  select id into v_rid from public.restaurants where owner_id = auth.uid() limit 1;
  if v_rid is null then
    return json_build_object('allowed', false, 'error', 'no_restaurant');
  end if;

  insert into public.message_counters (restaurant_id, day, count)
    values (v_rid, v_day, 0)
    on conflict (restaurant_id, day) do nothing;

  select count into v_count
    from public.message_counters
    where restaurant_id = v_rid and day = v_day
    for update;

  if v_count >= p_limit then
    return json_build_object('allowed', false, 'count', v_count, 'limit', p_limit);
  end if;

  update public.message_counters
    set count = count + 1
    where restaurant_id = v_rid and day = v_day;

  return json_build_object('allowed', true, 'count', v_count + 1, 'limit', p_limit);
end;
$$;

grant execute on function public.increment_message_count(integer) to authenticated;
