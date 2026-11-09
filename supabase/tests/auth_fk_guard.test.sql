-- Fremdschlüssel-Wächter (SIN-1612): Die Migrationsrolle des Cloud-Projekts darf auth.users nicht mehr
-- referenzieren (Lauf 42680100805: "permission denied for table users"). Neue Nutzertabellen hängen deshalb
-- an lifestyle.profiles (id); die Kette profiles -> auth.users löscht weiter mit.
-- profiles, water_logs und consents sind im Cloud-Projekt schon mit dem alten Fremdschlüssel eingespielt und bleiben so.
begin;
select plan(2);

select set_eq(
  $$ select c.conrelid::regclass::text
     from pg_constraint c
     join pg_class t on t.oid = c.conrelid
     join pg_namespace n on n.oid = t.relnamespace
     where c.contype = 'f' and n.nspname = 'lifestyle' and c.confrelid = 'auth.users'::regclass $$,
  array['lifestyle.profiles', 'lifestyle.water_logs', 'lifestyle.consents'],
  'Nur die drei schon eingespielten Tabellen referenzieren auth.users'
);

-- Jede weitere Tabelle mit user_id braucht den löschenden Fremdschlüssel auf lifestyle.profiles.
select is_empty(
  $$ select a.attrelid::regclass::text
     from pg_attribute a
     join pg_class t on t.oid = a.attrelid
     join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'lifestyle' and t.relkind in ('r', 'p') and a.attname = 'user_id' and not a.attisdropped
       and t.relname not in ('water_logs', 'consents')
       and not exists (
         select 1 from pg_constraint c
         where c.contype = 'f' and c.conrelid = a.attrelid and c.conkey = array[a.attnum]
           and c.confrelid = 'lifestyle.profiles'::regclass and c.confdeltype = 'c'
       ) $$,
  'Jede neue Tabelle mit user_id hängt mit on delete cascade an lifestyle.profiles'
);

select * from finish();
rollback;
