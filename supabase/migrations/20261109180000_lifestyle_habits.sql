-- SIN-1296: Gewohnheiten und ihre Tages-Häkchen. Kein Art.-9-Inhalt (Einwilligung A laut docs/PRIVACY.md), deshalb ohne Einwilligung B.
-- Bewusst keine Streak-Spalten: kein Druck (docs/ONBOARDING.md Grundregel 3).
-- user_id hängt an lifestyle.profiles, nicht an auth.users: Die Migrationsrolle darf auth.users nicht referenzieren (SIN-1612).
create table lifestyle.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references lifestyle.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  active boolean not null default true,
  sort smallint not null default 0,
  created_at timestamptz not null default now()
);

create table lifestyle.habit_checks (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references lifestyle.habits (id) on delete cascade,
  user_id uuid not null references lifestyle.profiles (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  constraint habit_checks_one_per_day unique (habit_id, day)
);

create index habit_checks_user_id_day_idx
  on lifestyle.habit_checks (user_id, day desc);

alter table lifestyle.habits enable row level security;
alter table lifestyle.habit_checks enable row level security;

revoke all on lifestyle.habits, lifestyle.habit_checks from public, anon;
grant select, insert, update, delete on lifestyle.habits to authenticated;
-- Häkchen werden gesetzt oder gelöscht, nicht geändert.
grant select, insert, delete on lifestyle.habit_checks to authenticated;

create policy habits_select_own on lifestyle.habits
  for select to authenticated using ((select auth.uid()) = user_id);
create policy habits_insert_own on lifestyle.habits
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy habits_update_own on lifestyle.habits
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy habits_delete_own on lifestyle.habits
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Ein Häkchen gehört der Person und hängt an einer ihrer eigenen Gewohnheiten.
create policy habit_checks_select_own on lifestyle.habit_checks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy habit_checks_insert_own on lifestyle.habit_checks
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from lifestyle.habits h where h.id = habit_id and h.user_id = (select auth.uid()))
  );
create policy habit_checks_delete_own on lifestyle.habit_checks
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function lifestyle.delete_own_data()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from lifestyle.water_logs where user_id = (select auth.uid());
  delete from lifestyle.habit_checks where user_id = (select auth.uid());
  delete from lifestyle.habits where user_id = (select auth.uid());
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
