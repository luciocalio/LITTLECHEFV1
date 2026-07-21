-- ══════════════════════════════════════════════════════════════
--  LITTLECHEF · 003_storage.sql
--  Bucket loghi: lettura pubblica dei file, scrittura consentita
--  SOLO nel percorso {auth.uid()}/... del proprietario.
-- ══════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('restaurant-logos', 'restaurant-logos', true)
on conflict (id) do nothing;

-- Lettura pubblica dei singoli file del bucket loghi
create policy "logos_public_read" on storage.objects
  for select using (bucket_id = 'restaurant-logos');

-- Scrittura solo nel proprio percorso {uid}/...
create policy "logos_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'restaurant-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "logos_owner_update" on storage.objects
  for update using (
    bucket_id = 'restaurant-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'restaurant-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "logos_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'restaurant-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
