create table lifestyle.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_ml integer not null check (amount_ml between 1 and 5000),
  logged_at timestamptz not null default now()
);

create index water_logs_user_id_logged_at_idx
  on lifestyle.water_logs (user_id, logged_at desc);

alter table lifestyle.water_logs enable row level security;

revoke all on lifestyle.water_logs from public, anon;
grant select, insert, delete on lifestyle.water_logs to authenticated;

create policy water_logs_select_own on lifestyle.water_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy water_logs_insert_own on lifestyle.water_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy water_logs_delete_own on lifestyle.water_logs
  for delete to authenticated using ((select auth.uid()) = user_id);
