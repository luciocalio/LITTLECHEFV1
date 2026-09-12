-- ══════════════════════════════════════════════════════════════
--  LITTLECHEF · 005_vat_rate.sql
--  Aliquota IVA per ristorante (Stage 10, Punto 1). Il prezzo che
--  l'utente inserisce per un piatto resta IVA inclusa; questa colonna
--  serve a calcolare il ricavo netto prima di margine/food cost %.
--  DEFAULT 10 (aliquota standard ristorazione IT) si applica anche
--  alle righe già esistenti — nessun piatto già creato si rompe.
--  Nessuna modifica alle policy RLS: sono a livello di riga su
--  public.restaurants e coprono automaticamente anche questa colonna.
-- ══════════════════════════════════════════════════════════════

alter table public.restaurants
  add column if not exists vat_rate numeric not null default 10;
