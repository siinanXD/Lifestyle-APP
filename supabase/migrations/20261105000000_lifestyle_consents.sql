-- Einwilligungen A bis E (docs/PRIVACY.md, Abschnitt 3): einzeln, mit Zeitstempel und Textversion, widerrufbar.
create table lifestyle.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('A', 'B', 'C', 'D', 'E')),
  text_version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- Je Person und Art höchstens eine offene Einwilligung; nach dem Widerruf ist eine neue Erteilung möglich.
create unique index consents_one_open_per_kind_idx
  on lifestyle.consents (user_id, kind) where revoked_at is null;

alter table lifestyle.consents enable row level security;

revoke all on lifestyle.consents from public, anon;
-- Kein delete: Der Nachweis bleibt bis zur Kontolöschung. Ändern darf man nur den Widerruf.
grant select, insert on lifestyle.consents to authenticated;
grant update (revoked_at) on lifestyle.consents to authenticated;

create policy consents_select_own on lifestyle.consents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy consents_insert_own on lifestyle.consents
  for insert to authenticated with check ((select auth.uid()) = user_id);
-- Nur offene Zeilen: Ein gesetzter Widerruf bleibt als Nachweis stehen.
create policy consents_revoke_own on lifestyle.consents
  for update to authenticated
  using ((select auth.uid()) = user_id and revoked_at is null)
  with check ((select auth.uid()) = user_id);

-- "Konto löschen" (SIN-1198) entfernt jetzt auch die Einwilligungen (Reihenfolge wie bisher, neue Tabelle am Ende).
create or replace function lifestyle.delete_own_data()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from lifestyle.water_logs where user_id = (select auth.uid());
  delete from lifestyle.profiles where id = (select auth.uid());
  delete from lifestyle.consents where user_id = (select auth.uid());
$$;
