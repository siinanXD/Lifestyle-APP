-- SIN-1277: Aktivitäten ohne Sätze und Gewicht (Cardio, Mobility, Dehnen, weitere Sportarten).
-- Art. 9 (docs/PRIVACY.md Abschnitt 2, Kategorie Training): Schreiben nur mit offener Einwilligung B, Lesen und Löschen ohne.
-- user_id hängt an lifestyle.profiles, nicht an auth.users: Die Migrationsrolle darf auth.users nicht referenzieren (SIN-1612).
create table lifestyle.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references lifestyle.profiles (id) on delete cascade,
  activity text not null check (char_length(activity) between 1 and 60),
  category text not null check (category in ('cardio', 'mobility', 'dehnen', 'sonstiges')),
  started_at timestamptz not null default now(),
  duration_min smallint not null check (duration_min between 1 and 1440),
  distance_km numeric(6,2) check (distance_km between 0 and 1000),
  effort smallint check (effort between 1 and 10), -- gefühlte Anstrengung
  note text check (char_length(note) <= 200)
);

create index activity_logs_user_id_started_at_idx
  on lifestyle.activity_logs (user_id, started_at desc);

alter table lifestyle.activity_logs enable row level security;

revoke all on lifestyle.activity_logs from public, anon;
grant select, insert, update, delete on lifestyle.activity_logs to authenticated;

create policy activity_logs_select_own on lifestyle.activity_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy activity_logs_insert_own on lifestyle.activity_logs
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from lifestyle.consents c where c.user_id = (select auth.uid()) and c.kind = 'B' and c.revoked_at is null)
  );
create policy activity_logs_update_own on lifestyle.activity_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from lifestyle.consents c where c.user_id = (select auth.uid()) and c.kind = 'B' and c.revoked_at is null)
  );
create policy activity_logs_delete_own on lifestyle.activity_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function lifestyle.delete_own_data()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from lifestyle.water_logs where user_id = (select auth.uid());
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
