-- SIN-1280: freiwillige Smart-Comeback-Angaben als eigene Tabelle, damit sie sich getrennt löschen lassen (Aufbewahrung 12 Monate, docs/PRIVACY.md Abschnitt 2).
-- Art. 9 (Befinden & Comeback): Einfügen nur mit offener Einwilligung B, Lesen und Löschen ohne. Kein Update: Angaben sind Momentaufnahmen.
-- user_id hängt an lifestyle.profiles, nicht an auth.users: Die Migrationsrolle darf auth.users nicht referenzieren (SIN-1612).
create table lifestyle.comeback_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references lifestyle.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  days_since_last smallint not null check (days_since_last between 0 and 3650),
  reason text check (reason in ('urlaub', 'krank_oder_verletzt', 'stress', 'keine_lust', 'anderes')), -- null = nicht angegeben, kein Freitext
  feeling text check (feeling in ('gut', 'mittel', 'schlecht')), -- null = nicht angegeben
  level smallint not null check (level between 0 and 3) -- berechnete Comeback-Stufe
);

-- trägt auch die spätere automatische Löschung nach 12 Monaten (purge_expired, eigenes Issue)
create index comeback_checkins_user_id_created_at_idx
  on lifestyle.comeback_checkins (user_id, created_at desc);

alter table lifestyle.comeback_checkins enable row level security;

revoke all on lifestyle.comeback_checkins from public, anon;
grant select, insert, delete on lifestyle.comeback_checkins to authenticated;

create policy comeback_checkins_select_own on lifestyle.comeback_checkins
  for select to authenticated using ((select auth.uid()) = user_id);
create policy comeback_checkins_insert_own on lifestyle.comeback_checkins
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from lifestyle.consents c where c.user_id = (select auth.uid()) and c.kind = 'B' and c.revoked_at is null)
  );
create policy comeback_checkins_delete_own on lifestyle.comeback_checkins
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function lifestyle.delete_own_data()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from lifestyle.water_logs where user_id = (select auth.uid());
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
