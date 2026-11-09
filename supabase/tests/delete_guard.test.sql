-- Lösch-Wächter (SIN-1253, docs/PRIVACY.md Abschnitt 6): Jede Tabelle im Schema lifestyle muss in
-- lifestyle.delete_own_data() vorkommen. Neue Tabellen fallen automatisch hinein; wer die Zeile in der
-- Funktion vergisst, macht diesen Test rot.
begin;
select plan(3);

create function pg_temp.delete_guard_missing() returns setof text
language sql as $$
  select c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'lifestyle' and c.relkind in ('r', 'p')
    -- Ausnahmen: Referenztabellen ohne Nutzerbezug
    and c.relname not in (
      'exercises' -- Übungskatalog, für alle gleich
    )
    and pg_get_functiondef('lifestyle.delete_own_data'::regproc) !~ ('delete from lifestyle\.' || c.relname || '\M')
$$;

-- Der Wächter sieht überhaupt Tabellen (fängt einen Tippfehler im Schemanamen).
select cmp_ok(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'lifestyle' and c.relkind in ('r', 'p')),
  '>=', 2::bigint, 'Schema lifestyle enthält Tabellen'
);

select is_empty(
  $$ select * from pg_temp.delete_guard_missing() $$,
  'delete_own_data() löscht aus jeder Nutzertabelle in lifestyle'
);

-- Negativprobe: eine neue Nutzertabelle, die nicht in der Funktion steht, muss auffallen.
-- "workouts_archiv" beginnt wie eine vorhandene Tabelle und darf trotzdem nicht als abgedeckt gelten.
create table lifestyle.probe_vergessen (user_id uuid);
create table lifestyle.workouts_archiv (user_id uuid);
select set_eq(
  $$ select * from pg_temp.delete_guard_missing() $$,
  array['probe_vergessen', 'workouts_archiv'],
  'Wächter schlägt bei einer Nutzertabelle an, die in delete_own_data() fehlt'
);

select * from finish();
rollback;
