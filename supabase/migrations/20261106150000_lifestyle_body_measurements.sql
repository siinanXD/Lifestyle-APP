-- SIN-1259: Körperwerte (Art. 9, Einwilligung B), eine Messung je Tag. Bewusst kein Körperfett, kein BMI, kein Zielgewicht.
create table lifestyle.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric(5,1) check (weight_kg between 20 and 400),
  waist_cm numeric(4,1) check (waist_cm between 10 and 300),
  chest_cm numeric(4,1) check (chest_cm between 10 and 300),
  upper_arm_cm numeric(4,1) check (upper_arm_cm between 10 and 300),
  thigh_cm numeric(4,1) check (thigh_cm between 10 and 300),
  constraint body_measurements_not_empty
    check (num_nonnulls(weight_kg, waist_cm, chest_cm, upper_arm_cm, thigh_cm) > 0),
  constraint body_measurements_one_per_day unique (user_id, measured_on)
);

create index body_measurements_user_id_measured_on_idx
  on lifestyle.body_measurements (user_id, measured_on desc);

alter table lifestyle.body_measurements enable row level security;

revoke all on lifestyle.body_measurements from public, anon;
grant select, insert, update, delete on lifestyle.body_measurements to authenticated;

create policy body_measurements_select_own on lifestyle.body_measurements
  for select to authenticated using ((select auth.uid()) = user_id);
create policy body_measurements_insert_own on lifestyle.body_measurements
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy body_measurements_update_own on lifestyle.body_measurements
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy body_measurements_delete_own on lifestyle.body_measurements
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function lifestyle.delete_own_data()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from lifestyle.water_logs where user_id = (select auth.uid());
  delete from lifestyle.body_measurements where user_id = (select auth.uid());
  delete from lifestyle.health_profile where user_id = (select auth.uid());
  delete from lifestyle.profiles where id = (select auth.uid());
  delete from lifestyle.consents where user_id = (select auth.uid());
$$;
