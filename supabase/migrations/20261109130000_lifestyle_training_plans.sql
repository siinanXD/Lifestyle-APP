-- SIN-1282: Trainingspläne. Kein Art.-9-Inhalt (nur Übungen, Sätze, Wiederholungsbereiche), deshalb ohne Einwilligung B.
-- user_id hängt an lifestyle.profiles, nicht an auth.users: Die Migrationsrolle darf auth.users nicht referenzieren (SIN-1612).
create table lifestyle.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references lifestyle.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  source text not null default 'regeln' check (source in ('regeln', 'manuell')),
  general boolean not null default false, -- true = allgemeiner Vorschlag ohne Angaben
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- höchstens ein aktiver Plan je Person
create unique index training_plans_one_active_per_user on lifestyle.training_plans (user_id) where active;

create table lifestyle.plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references lifestyle.training_plans (id) on delete cascade,
  user_id uuid not null references lifestyle.profiles (id) on delete cascade,
  day_no smallint not null check (day_no between 1 and 7),
  position smallint not null,
  exercise_id uuid not null references lifestyle.exercises (id),
  sets smallint not null check (sets between 1 and 10),
  rep_min smallint not null check (rep_min between 1 and 100),
  rep_max smallint not null check (rep_max between 1 and 100),
  constraint plan_items_rep_range check (rep_min <= rep_max),
  constraint plan_items_unique_position unique (plan_id, day_no, position)
);

alter table lifestyle.training_plans enable row level security;
alter table lifestyle.plan_items enable row level security;

revoke all on lifestyle.training_plans, lifestyle.plan_items from public, anon;
grant select, insert, update, delete on lifestyle.training_plans, lifestyle.plan_items to authenticated;

create policy training_plans_select_own on lifestyle.training_plans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy training_plans_insert_own on lifestyle.training_plans
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy training_plans_update_own on lifestyle.training_plans
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy training_plans_delete_own on lifestyle.training_plans
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Eine Position gehört der Person und hängt an einem ihrer eigenen Pläne.
create policy plan_items_select_own on lifestyle.plan_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy plan_items_insert_own on lifestyle.plan_items
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from lifestyle.training_plans p where p.id = plan_id and p.user_id = (select auth.uid()))
  );
create policy plan_items_update_own on lifestyle.plan_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from lifestyle.training_plans p where p.id = plan_id and p.user_id = (select auth.uid()))
  );
create policy plan_items_delete_own on lifestyle.plan_items
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function lifestyle.delete_own_data()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from lifestyle.water_logs where user_id = (select auth.uid());
  delete from lifestyle.plan_items where user_id = (select auth.uid());
  delete from lifestyle.training_plans where user_id = (select auth.uid());
  delete from lifestyle.workout_sets where user_id = (select auth.uid());
  delete from lifestyle.workouts where user_id = (select auth.uid());
  delete from lifestyle.body_measurements where user_id = (select auth.uid());
  delete from lifestyle.health_profile where user_id = (select auth.uid());
  delete from lifestyle.profiles where id = (select auth.uid());
  delete from lifestyle.consents where user_id = (select auth.uid());
$$;
