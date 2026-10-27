create schema lifestyle;

create table lifestyle.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table lifestyle.profiles enable row level security;

revoke all on schema lifestyle from public, anon;
revoke all on lifestyle.profiles from public, anon;
grant usage on schema lifestyle to authenticated;
grant select, insert, update on lifestyle.profiles to authenticated;

create policy profiles_select_own on lifestyle.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on lifestyle.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on lifestyle.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
