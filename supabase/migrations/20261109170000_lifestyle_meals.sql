-- SIN-1292: Mahlzeiten (manuell, später auch aus Barcode oder Foto); alle Nährwerte sind freiwillig.
-- Art. 9 (docs/PRIVACY.md Abschnitt 2, Kategorie Ernährung): Schreiben nur mit offener Einwilligung B, Lesen und Löschen ohne.
-- user_id hängt an lifestyle.profiles, nicht an auth.users: Die Migrationsrolle darf auth.users nicht referenzieren (SIN-1612).
create table lifestyle.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references lifestyle.profiles (id) on delete cascade,
  eaten_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 100),
  amount_note text check (char_length(amount_note) <= 60), -- z. B. „1 Portion“
  kcal integer check (kcal between 0 and 5000),
  protein_g numeric(6,1) check (protein_g between 0 and 1000),
  carbs_g numeric(6,1) check (carbs_g between 0 and 1000),
  fat_g numeric(6,1) check (fat_g between 0 and 1000),
  source text not null default 'manuell' check (source in ('manuell', 'barcode', 'foto')),
  estimated boolean not null default false, -- true = Schätzung, nicht gemessen
  barcode text check (barcode ~ '^[0-9]{8,14}$')
);

create index meals_user_id_eaten_at_idx
  on lifestyle.meals (user_id, eaten_at desc);

alter table lifestyle.meals enable row level security;

revoke all on lifestyle.meals from public, anon;
grant select, insert, update, delete on lifestyle.meals to authenticated;

create policy meals_select_own on lifestyle.meals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy meals_insert_own on lifestyle.meals
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from lifestyle.consents c where c.user_id = (select auth.uid()) and c.kind = 'B' and c.revoked_at is null)
  );
create policy meals_update_own on lifestyle.meals
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from lifestyle.consents c where c.user_id = (select auth.uid()) and c.kind = 'B' and c.revoked_at is null)
  );
create policy meals_delete_own on lifestyle.meals
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function lifestyle.delete_own_data()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from lifestyle.water_logs where user_id = (select auth.uid());
  delete from lifestyle.meals where user_id = (select auth.uid());
  delete from lifestyle.sleep_logs where user_id = (select auth.uid());
  delete from lifestyle.comeback_checkins where user_id = (select auth.uid());
  delete from lifestyle.activity_logs where user_id = (select auth.uid());
  delete from lifestyle.plan_items where user_id = (select auth.uid());
  delete from lifestyle.training_plans where user_id = (select auth.uid());
  delete from lifestyle.workout_sets where user_id = (select auth.uid());
  delete from lifestyle.workouts where user_id = (select auth.uid());
  delete from lifestyle.body_measurements where user_id = (select auth.uid());
  delete from lifestyle.health_profile where user_id = (select auth.uid());
  delete from lifestyle.profiles where id = (select auth.uid());
  delete from lifestyle.consents where user_id = (select auth.uid());
$$;
