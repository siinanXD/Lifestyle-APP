-- SIN-1290: Schlaf-Protokoll, ein Eintrag je Person und Tag (Dauer, Selbstangabe der Qualität).
-- Art. 9 (docs/PRIVACY.md Abschnitt 2, Kategorie Schlaf): Schreiben nur mit offener Einwilligung B, Lesen und Löschen ohne.
-- user_id hängt an lifestyle.profiles, nicht an auth.users: Die Migrationsrolle darf auth.users nicht referenzieren (SIN-1612).
create table lifestyle.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references lifestyle.profiles (id) on delete cascade,
  slept_on date not null, -- Datum des Aufwachens
  duration_min smallint not null check (duration_min between 30 and 1200),
  quality smallint check (quality between 1 and 5), -- Selbstangabe
  note text check (char_length(note) <= 200),
  constraint sleep_logs_one_per_day unique (user_id, slept_on)
);

create index sleep_logs_user_id_slept_on_idx
  on lifestyle.sleep_logs (user_id, slept_on desc);

alter table lifestyle.sleep_logs enable row level security;

revoke all on lifestyle.sleep_logs from public, anon;
grant select, insert, update, delete on lifestyle.sleep_logs to authenticated;

create policy sleep_logs_select_own on lifestyle.sleep_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy sleep_logs_insert_own on lifestyle.sleep_logs
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from lifestyle.consents c where c.user_id = (select auth.uid()) and c.kind = 'B' and c.revoked_at is null)
  );
create policy sleep_logs_update_own on lifestyle.sleep_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from lifestyle.consents c where c.user_id = (select auth.uid()) and c.kind = 'B' and c.revoked_at is null)
  );
create policy sleep_logs_delete_own on lifestyle.sleep_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function lifestyle.delete_own_data()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from lifestyle.water_logs where user_id = (select auth.uid());
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
