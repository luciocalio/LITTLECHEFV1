-- ══════════════════════════════════════════════════════════════
--  LITTLECHEF · 001_schema.sql
--  Schema fedele ai dati IndexedDB reali (audit Stage 1A).
--  PK in formato text perché gli id esistenti sono stringhe
--  ('dish_xxx', 'demo_ing_xxx') e i components li referenziano
--  via id_ref. Colonne camelCase quotate = zero adapter lato app.
-- ══════════════════════════════════════════════════════════════

-- RISTORANTI (1 riga per account)
create table if not exists public.restaurants (
  id                          uuid primary key default gen_random_uuid(),
  owner_id                    uuid not null references auth.users(id) on delete cascade,
  name                        text not null,
  logo_url                    text,
  estimated_monthly_revenue   numeric not null default 0,
  created_at                  timestamptz not null default now()
);

-- PIATTI
create table if not exists public.dishes (
  id                    text primary key default gen_random_uuid()::text,
  restaurant_id         uuid not null references public.restaurants(id) on delete cascade,
  name                  text not null,
  category              text,
  price                 numeric,
  selling_price         numeric,
  food_cost             numeric,
  margin_euro           numeric,
  margin_pct            numeric,
  status                text,
  allergens             jsonb not null default '[]'::jsonb,
  "internalNotes"       text not null default '',
  "isVisible"           boolean not null default true,
  "isSpecial"           boolean not null default false,
  "ingredientUpdatedAt" timestamptz,
  components            jsonb not null default '[]'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- DISPENSA (store IndexedDB "ingredients")
create table if not exists public.pantry_items (
  id              text primary key default gen_random_uuid()::text,
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  name            text not null,
  unit            text,
  price           numeric,
  price_per_unit  numeric,
  waste           numeric not null default 0,
  allergens       jsonb not null default '[]'::jsonb,
  "_isPrep"       boolean not null default false,
  updated_at      timestamptz not null default now()
);

-- PREPARAZIONI
create table if not exists public.preparations (
  id              text primary key default gen_random_uuid()::text,
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  name            text not null,
  unit            text,
  yield_unit      text,
  price           numeric,
  price_per_unit  numeric,
  waste           numeric not null default 0,
  allergens       jsonb not null default '[]'::jsonb,
  "_isPrep"       boolean not null default true,
  total_cost      numeric,
  total_yield     numeric,
  components      jsonb not null default '[]'::jsonb,
  updated_at      timestamptz not null default now()
);

-- COSTI FISSI
create table if not exists public.fixed_costs (
  id              text primary key default gen_random_uuid()::text,
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  name            text not null,
  type            text,
  amount_monthly  numeric not null default 0,
  note            text not null default '',
  updated_at      timestamptz not null default now()
);

-- SEZIONI MENU
create table if not exists public.sections (
  id              text primary key default gen_random_uuid()::text,
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  name            text not null,
  "order"         integer not null default 0
);

-- Indici sulle FK (le query filtrano sempre per restaurant_id)
create index if not exists idx_dishes_restaurant       on public.dishes(restaurant_id);
create index if not exists idx_pantry_restaurant       on public.pantry_items(restaurant_id);
create index if not exists idx_preparations_restaurant on public.preparations(restaurant_id);
create index if not exists idx_fixed_costs_restaurant  on public.fixed_costs(restaurant_id);
create index if not exists idx_sections_restaurant     on public.sections(restaurant_id);
create index if not exists idx_restaurants_owner       on public.restaurants(owner_id);
