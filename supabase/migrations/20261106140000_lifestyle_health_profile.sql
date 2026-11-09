-- SIN-1258: Einschränkungen und Größe sind Gesundheitsdaten (Art. 9, Einwilligung B) und liegen getrennt von
-- lifestyle.profiles, damit Widerruf B genau diese Zeile löschen kann. Keine Diagnose- oder Medikamentenfelder.
create table lifestyle.health_profile (
  user_id uuid primary key references auth.users (id) on delete cascade,
  restrictions text[] not null default '{}'
    constraint health_profile_restrictions_values
    check (restrictions <@ array['knie', 'ruecken', 'schulter', 'handgelenk', 'sonstiges']::text[]),
  restriction_note text
    constraint health_profile_restriction_note_len check (char_length(restriction_note) <= 200),
  height_cm smallint
    constraint health_profile_height_cm_range check (height_cm between 100 and 250),
  updated_at timestamptz not null default now()
);

alter table lifestyle.health_profile enable row level security;

revoke all on lifestyle.health_profile from public, anon;
grant select, insert, update, delete on lifestyle.health_profile to authenticated;

create policy health_profile_select_own on lifestyle.health_profile
  for select to authenticated using ((select auth.uid()) = user_id);
create policy health_profile_insert_own on lifestyle.health_profile
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy health_profile_update_own on lifestyle.health_profile
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy health_profile_delete_own on lifestyle.health_profile
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function lifestyle.delete_own_data()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from lifestyle.water_logs where user_id = (select auth.uid());
  delete from lifestyle.health_profile where user_id = (select auth.uid());
  delete from lifestyle.profiles where id = (select auth.uid());
  delete from lifestyle.consents where user_id = (select auth.uid());
$$;
