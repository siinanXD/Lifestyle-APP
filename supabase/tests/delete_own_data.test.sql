begin;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@example.test');
insert into lifestyle.profiles (id)
values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
insert into lifestyle.water_logs (user_id, amount_ml)
values
  ('00000000-0000-0000-0000-00000000000a', 250),
  ('00000000-0000-0000-0000-00000000000b', 300);
-- Je Nutzertabelle eine Zeile für A und B (Platzhalter, keine echten Gesundheitsdaten).
insert into lifestyle.consents (user_id, kind, text_version)
values ('00000000-0000-0000-0000-00000000000a', 'B', 'v1'), ('00000000-0000-0000-0000-00000000000b', 'B', 'v1');
insert into lifestyle.health_profile (user_id, restrictions)
values ('00000000-0000-0000-0000-00000000000a', '{knie}'), ('00000000-0000-0000-0000-00000000000b', '{knie}');
insert into lifestyle.body_measurements (user_id, weight_kg)
values ('00000000-0000-0000-0000-00000000000a', 70), ('00000000-0000-0000-0000-00000000000b', 70);
insert into lifestyle.exercises (id, slug, name, category, technique)
values ('30000000-0000-0000-0000-000000000001', 'test-loeschen-rudern', 'Test-Rudern', 'kraft', 'Platzhalter.');
insert into lifestyle.workouts (id, user_id)
values
  ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a'),
  ('40000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b');
insert into lifestyle.workout_sets (workout_id, user_id, exercise_id, set_no, reps)
values
  ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001', 1, 10),
  ('40000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-000000000001', 1, 10);

-- Zählt die Zeilen einer Person über alle Tabellen in lifestyle mit Spalte user_id; neue Tabellen zählen automatisch mit.
create function pg_temp.zeilen_von(nutzer uuid) returns int
language plpgsql as $$
declare t regclass; n int; summe int := 0;
begin
  for t in
    select a.attrelid::regclass from pg_attribute a
    join pg_class c on c.oid = a.attrelid join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'lifestyle' and c.relkind in ('r', 'p') and a.attname = 'user_id' and not a.attisdropped
  loop
    execute format('select count(*) from %s where user_id = $1', t) into n using nutzer;
    summe := summe + n;
  end loop;
  return summe;
end $$;
select is(pg_temp.zeilen_von('00000000-0000-0000-0000-00000000000a'), 6, 'A hat vor dem Löschen in jeder Nutzertabelle eine Zeile');

-- Konto aus einer anderen App (C): ohne Profil, sieht nichts Fremdes, legt das eigene an.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is_empty($$ select 1 from lifestyle.profiles $$, 'C ohne Profil sieht keine fremden Profile');
select is_empty($$ select 1 from lifestyle.water_logs $$, 'C sieht keine fremden Wasser-Einträge');
select lives_ok(
  $$ insert into lifestyle.profiles (id) values ('00000000-0000-0000-0000-00000000000c') $$,
  'C legt beim ersten Login das eigene Profil an'
);

-- A löscht die eigenen Daten
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select lifestyle.delete_own_data() $$, 'A löscht die eigenen Daten');
reset role;

select is_empty(
  $$ select 1 from lifestyle.profiles where id = '00000000-0000-0000-0000-00000000000a'
     union all select 1 where pg_temp.zeilen_von('00000000-0000-0000-0000-00000000000a') > 0 $$,
  'von A ist in keiner Tabelle etwas übrig'
);
select is(
  (select count(*)::int from lifestyle.profiles where id <> '00000000-0000-0000-0000-00000000000a')
  + pg_temp.zeilen_von('00000000-0000-0000-0000-00000000000b'),
  8,
  'die Daten von B und C bleiben'
);

set local role anon;
select throws_ok($$ select lifestyle.delete_own_data() $$, '42501', null, 'anon darf die Funktion nicht aufrufen');
reset role;

select * from finish();
rollback;
