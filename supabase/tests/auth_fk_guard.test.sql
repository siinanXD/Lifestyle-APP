-- Fremdschlüssel-Wächter: Die Migrationsrolle des Cloud-Projekts darf auth.users nicht mehr referenzieren
-- (Lauf 42680100805: "permission denied for table users"). Neue Nutzertabellen hängen deshalb an
-- lifestyle.profiles (id); die Kette profiles -> auth.users löscht weiter mit.
-- Die drei Tabellen unten sind im Cloud-Projekt schon mit dem alten Fremdschlüssel eingespielt und bleiben so.
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

select set_eq(
  $$ select c.conrelid::regclass::text
     from pg_constraint c
     where c.contype = 'f' and c.confrelid = 'lifestyle.profiles'::regclass and c.confdeltype = 'c' $$,
  array['lifestyle.health_profile', 'lifestyle.body_measurements', 'lifestyle.workouts', 'lifestyle.workout_sets'],
  'Gesundheitstabellen hängen mit on delete cascade an lifestyle.profiles'
);

select * from finish();
rollback;
