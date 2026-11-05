-- RLS-Wächter (SIN-1252, AGENTS.md Regel 5): prüft per Katalogabfrage jede Tabelle im
-- Schema lifestyle, ohne Tabellennamen zu kennen. Neue Tabellen fallen automatisch hinein.
--
-- Regeln je Tabelle:
--   rls_aus                     relrowsecurity ist false
--   keine_policy_aber_zugriff   keine Policy, obwohl authenticated oder anon Rechte haben
--                               (Ausnahme: reine Funktions-Tabellen ohne jedes Recht für beide)
--   anon_oder_public_zugriff    anon oder public hat ein Tabellen- oder Spaltenrecht
-- Views, Materialized Views und Fremdtabellen sind nicht Teil dieses Wächters.
begin;
select plan(3);

create function pg_temp.guard_violations() returns table (tbl text, regel text)
language sql as $$
  with t as (
    select c.oid, c.relname::text as name, c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'lifestyle' and c.relkind in ('r', 'p')
  )
  select name, 'rls_aus' from t where not relrowsecurity
  union all
  select name, 'keine_policy_aber_zugriff' from t
  where not exists (
      select 1 from pg_policies p where p.schemaname = 'lifestyle' and p.tablename = t.name
    )
    and (
      has_table_privilege('authenticated', oid, 'select,insert,update,delete,truncate,references,trigger')
      or has_any_column_privilege('authenticated', oid, 'select,insert,update,references')
      or has_table_privilege('anon', oid, 'select,insert,update,delete,truncate,references,trigger')
      or has_any_column_privilege('anon', oid, 'select,insert,update,references')
    )
  union all
  select name, 'anon_oder_public_zugriff' from t
  where has_table_privilege('anon', oid, 'select,insert,update,delete,truncate,references,trigger')
    or has_any_column_privilege('anon', oid, 'select,insert,update,references')
    or has_table_privilege('public', oid, 'select,insert,update,delete,truncate,references,trigger')
    or has_any_column_privilege('public', oid, 'select,insert,update,references')
$$;

-- Der Wächter sieht überhaupt Tabellen (fängt einen Tippfehler im Schemanamen).
select cmp_ok(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'lifestyle' and c.relkind in ('r', 'p')),
  '>=', 1::bigint, 'Schema lifestyle enthält Tabellen'
);

select is_empty(
  $$ select * from pg_temp.guard_violations() $$,
  'Jede Tabelle in lifestyle: RLS an, Policy (oder keine Rechte), kein Zugriff für anon/public'
);

-- Negativprobe: absichtlich kaputte Tabellen müssen den Wächter rot machen, zulässige nicht.
-- Alles bleibt in dieser Transaktion und wird zurückgerollt.
create table lifestyle.probe_no_rls (id int);
revoke all on lifestyle.probe_no_rls from public, anon, authenticated;

create table lifestyle.probe_rls_no_policy (id int);
alter table lifestyle.probe_rls_no_policy enable row level security;
revoke all on lifestyle.probe_rls_no_policy from public, anon, authenticated;
grant select on lifestyle.probe_rls_no_policy to authenticated;

create table lifestyle.probe_anon (id int);
alter table lifestyle.probe_anon enable row level security;
create policy probe_anon_select on lifestyle.probe_anon for select to authenticated using (true);
revoke all on lifestyle.probe_anon from public, anon, authenticated;
grant select on lifestyle.probe_anon to authenticated, anon;

create table lifestyle.probe_public (id int);
alter table lifestyle.probe_public enable row level security;
create policy probe_public_select on lifestyle.probe_public for select to authenticated using (true);
revoke all on lifestyle.probe_public from public, anon, authenticated;
grant select on lifestyle.probe_public to public;

-- zulässig: reine Funktions-Tabelle ohne Policy und ohne Rechte für authenticated/anon
create table lifestyle.probe_ok_internal (id int);
alter table lifestyle.probe_ok_internal enable row level security;
revoke all on lifestyle.probe_ok_internal from public, anon, authenticated;

-- zulässig: RLS, Policy, nur authenticated
create table lifestyle.probe_ok_policy (id int);
alter table lifestyle.probe_ok_policy enable row level security;
create policy probe_ok_policy_select on lifestyle.probe_ok_policy for select to authenticated using (true);
revoke all on lifestyle.probe_ok_policy from public, anon, authenticated;
grant select on lifestyle.probe_ok_policy to authenticated;

select set_eq(
  $$ select tbl, regel from pg_temp.guard_violations() where tbl like 'probe_%' $$,
  $$ values
    ('probe_no_rls', 'rls_aus'),
    ('probe_rls_no_policy', 'keine_policy_aber_zugriff'),
    ('probe_anon', 'anon_oder_public_zugriff'),
    ('probe_public', 'anon_oder_public_zugriff') $$,
  'Wächter schlägt bei Tabellen ohne RLS, ohne Policy und mit anon/public-Recht an, bei zulässigen nicht'
);

select * from finish();
rollback;
