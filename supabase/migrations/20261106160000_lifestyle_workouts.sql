-- SIN-1272: Trainingsprotokoll (Art. 9, Einwilligung B). Spalten folgen dem Typ `Einheit` aus lib/training/progression.ts.
create table lifestyle.workouts (
  id uuid primary key default gen_random_uuid(), -- der Client darf die UUID setzen (Offline-Sync)
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  plan_day_id uuid, -- Fremdschlüssel folgt mit dem Plan-Issue
  note text check (char_length(note) <= 200),
  regeneration text check (regeneration in ('gut', 'schlecht')),
  constraint workouts_ended_after_start check (ended_at >= started_at)
);

create table lifestyle.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references lifestyle.workouts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references lifestyle.exercises (id),
  set_no smallint not null check (set_no between 1 and 50),
  reps smallint not null check (reps between 0 and 500),
  weight_kg numeric(6,2) check (weight_kg between 0 and 1000), -- leer = Körpergewicht
  technique text not null default 'sauber' check (technique in ('sauber', 'wackelig')),
  pain boolean not null default false,
  created_at timestamptz not null default now(),
  constraint workout_sets_unique_set unique (workout_id, set_no, exercise_id)
);

create index workouts_user_id_started_at_idx on lifestyle.workouts (user_id, started_at desc);
create index workout_sets_user_id_exercise_id_created_at_idx
  on lifestyle.workout_sets (user_id, exercise_id, created_at desc);

alter table lifestyle.workouts enable row level security;
alter table lifestyle.workout_sets enable row level security;

revoke all on lifestyle.workouts, lifestyle.workout_sets from public, anon;
grant select, insert, update, delete on lifestyle.workouts, lifestyle.workout_sets to authenticated;

create policy workouts_select_own on lifestyle.workouts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy workouts_insert_own on lifestyle.workouts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy workouts_update_own on lifestyle.workouts
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy workouts_delete_own on lifestyle.workouts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Ein Satz gehört der Person und hängt an einem ihrer eigenen Workouts.
create policy workout_sets_select_own on lifestyle.workout_sets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy workout_sets_insert_own on lifestyle.workout_sets
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from lifestyle.workouts w where w.id = workout_id and w.user_id = (select auth.uid()))
  );
create policy workout_sets_update_own on lifestyle.workout_sets
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from lifestyle.workouts w where w.id = workout_id and w.user_id = (select auth.uid()))
  );
create policy workout_sets_delete_own on lifestyle.workout_sets
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function lifestyle.delete_own_data()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from lifestyle.water_logs where user_id = (select auth.uid());
  delete from lifestyle.workout_sets where user_id = (select auth.uid());
  delete from lifestyle.workouts where user_id = (select auth.uid());
  delete from lifestyle.body_measurements where user_id = (select auth.uid());
  delete from lifestyle.health_profile where user_id = (select auth.uid());
  delete from lifestyle.profiles where id = (select auth.uid());
  delete from lifestyle.consents where user_id = (select auth.uid());
$$;
