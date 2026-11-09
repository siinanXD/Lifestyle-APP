-- Einwilligung B an der Datenbankgrenze (Art. 9): INSERT, UPDATE und Upsert auf den vier Gesundheitstabellen.
-- A hat B offen, S ist Fremder mit B offen, N hat nur A offen (nie B), R hat B widerrufen. Nur Platzhalterdaten.
begin;
select plan(106);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's@example.test'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'n@example.test'),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r@example.test');
-- Die Profilzeile legt ensureProfile() beim Login an; die Gesundheitstabellen hängen daran.
insert into lifestyle.profiles (id)
values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'), ('00000000-0000-0000-0000-00000000000d');
insert into lifestyle.consents (user_id, kind, text_version, revoked_at)
values
  ('00000000-0000-0000-0000-00000000000a', 'B', 'v1', null),
  ('00000000-0000-0000-0000-00000000000b', 'B', 'v1', null),
  ('00000000-0000-0000-0000-00000000000c', 'A', 'v1', null),
  ('00000000-0000-0000-0000-00000000000d', 'B', 'v1', now());
insert into lifestyle.exercises (id, slug, name, category, technique)
values ('30000000-0000-0000-0000-000000000001', 'test-consent-rudern', 'Test-Rudern', 'kraft', 'Platzhalter.');

-- Bestand vor der Regel oder vor dem Widerruf (als Besitzer der Tabellen, ohne RLS). health_profile folgt nach dem Einfügen-Test.
insert into lifestyle.health_profile (user_id, restrictions)
values ('00000000-0000-0000-0000-00000000000b', '{knie}');
insert into lifestyle.body_measurements (id, user_id, measured_on, weight_kg)
values
  ('20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '2026-11-01', 70),
  ('20000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000c', '2026-11-01', 70),
  ('20000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000d', '2026-11-01', 70);
insert into lifestyle.workouts (id, user_id)
values
  ('40000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b'),
  ('40000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000c'),
  ('40000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000d');
insert into lifestyle.workout_sets (workout_id, user_id, exercise_id, set_no, reps)
values
  ('40000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-000000000001', 1, 10),
  ('40000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000c', '30000000-0000-0000-0000-000000000001', 1, 10),
  ('40000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000d', '30000000-0000-0000-0000-000000000001', 1, 10);

-- Keine Hintertür im Katalog: permissive Policies sind ODER-verknüpft
select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'lifestyle' and tablename in ('health_profile', 'body_measurements', 'workouts', 'workout_sets')
       and cmd in ('INSERT', 'UPDATE', 'ALL') and coalesce(with_check, '') not like '%consents%' $$,
  'keine Schreib-Policy ohne Einwilligungsprüfung (auch kein reiner Besitz-Pfad)'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'lifestyle' and tablename in ('health_profile', 'body_measurements', 'workouts', 'workout_sets')
     and cmd in ('INSERT', 'UPDATE', 'ALL')),
  8,
  'genau eine INSERT- und eine UPDATE-Policy je Tabelle'
);
select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'lifestyle' and tablename in ('health_profile', 'body_measurements', 'workouts', 'workout_sets')
       and coalesce(qual, '') like '%consents%' $$,
  'Lesen, Löschen und USING von UPDATE hängen nur am Besitz'
);

-- N (nie B): Einfügen in eine leere health_profile-Zeile
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok(
  $$ insert into lifestyle.health_profile (user_id) values ('00000000-0000-0000-0000-00000000000c') $$,
  '42501', null, 'N: health_profile INSERT ohne B schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.health_profile (user_id, height_cm) values ('00000000-0000-0000-0000-00000000000c', 180)
     on conflict (user_id) do update set height_cm = excluded.height_cm $$,
  '42501', null, 'N: health_profile Upsert (neu) ohne B schlägt fehl'
);

-- R (B widerrufen): dasselbe
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok(
  $$ insert into lifestyle.health_profile (user_id) values ('00000000-0000-0000-0000-00000000000d') $$,
  '42501', null, 'R: health_profile INSERT nach Widerruf schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.health_profile (user_id, height_cm) values ('00000000-0000-0000-0000-00000000000d', 180)
     on conflict (user_id) do update set height_cm = excluded.height_cm $$,
  '42501', null, 'R: health_profile Upsert (neu) nach Widerruf schlägt fehl'
);
reset role;

insert into lifestyle.health_profile (user_id, height_cm)
values ('00000000-0000-0000-0000-00000000000c', 170), ('00000000-0000-0000-0000-00000000000d', 170);

-- N: Bestand darf nicht geändert werden, bleibt aber lesbar
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);

select throws_ok(
  $$ update lifestyle.health_profile set height_cm = 180 where user_id = '00000000-0000-0000-0000-00000000000c' $$,
  '42501', null, 'N: health_profile UPDATE ohne B schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.health_profile (user_id, height_cm) values ('00000000-0000-0000-0000-00000000000c', 180)
     on conflict (user_id) do update set height_cm = excluded.height_cm $$,
  '42501', null, 'N: health_profile Upsert (Konflikt) ohne B schlägt fehl'
);
select is((select height_cm::int from lifestyle.health_profile where user_id = '00000000-0000-0000-0000-00000000000c'), 170, 'N liest die eigene health_profile-Zeile unverändert');

select throws_ok(
  $$ insert into lifestyle.body_measurements (user_id, measured_on, weight_kg) values ('00000000-0000-0000-0000-00000000000c', '2026-11-02', 80) $$,
  '42501', null, 'N: body_measurements INSERT ohne B schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.body_measurements (user_id, measured_on, weight_kg) values ('00000000-0000-0000-0000-00000000000c', '2026-11-03', 80)
     on conflict (user_id, measured_on) do update set weight_kg = excluded.weight_kg $$,
  '42501', null, 'N: body_measurements Upsert (neu) ohne B schlägt fehl'
);
select throws_ok(
  $$ update lifestyle.body_measurements set weight_kg = 80 where id = '20000000-0000-0000-0000-00000000000c' $$,
  '42501', null, 'N: body_measurements UPDATE ohne B schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.body_measurements (user_id, measured_on, weight_kg) values ('00000000-0000-0000-0000-00000000000c', '2026-11-01', 80)
     on conflict (user_id, measured_on) do update set weight_kg = excluded.weight_kg $$,
  '42501', null, 'N: body_measurements Upsert (Konflikt) ohne B schlägt fehl'
);
select is((select weight_kg::int from lifestyle.body_measurements where id = '20000000-0000-0000-0000-00000000000c'), 70, 'N liest die eigene Messung unverändert');

select throws_ok(
  $$ insert into lifestyle.workouts (id, user_id) values ('40000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000c') $$,
  '42501', null, 'N: workouts INSERT ohne B schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.workouts (id, user_id, note) values ('40000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-00000000000c', 'x')
     on conflict (id) do update set note = excluded.note $$,
  '42501', null, 'N: workouts Upsert (neu) ohne B schlägt fehl'
);
select throws_ok(
  $$ update lifestyle.workouts set note = 'x' where id = '40000000-0000-0000-0000-00000000000c' $$,
  '42501', null, 'N: workouts UPDATE ohne B schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.workouts (id, user_id, note) values ('40000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000c', 'x')
     on conflict (id) do update set note = excluded.note $$,
  '42501', null, 'N: workouts Upsert (Konflikt) ohne B schlägt fehl'
);
select is((select note from lifestyle.workouts where id = '40000000-0000-0000-0000-00000000000c'), null, 'N liest das eigene Workout unverändert');

select throws_ok(
  $$ insert into lifestyle.workout_sets (workout_id, user_id, exercise_id, set_no, reps)
     values ('40000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000c', '30000000-0000-0000-0000-000000000001', 2, 12) $$,
  '42501', null, 'N: workout_sets INSERT ohne B schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.workout_sets (workout_id, user_id, exercise_id, set_no, reps)
     values ('40000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000c', '30000000-0000-0000-0000-000000000001', 3, 12)
     on conflict (workout_id, set_no, exercise_id) do update set reps = excluded.reps $$,
  '42501', null, 'N: workout_sets Upsert (neu) ohne B schlägt fehl'
);
select throws_ok(
  $$ update lifestyle.workout_sets set reps = 12 where workout_id = '40000000-0000-0000-0000-00000000000c' $$,
  '42501', null, 'N: workout_sets UPDATE ohne B schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.workout_sets (workout_id, user_id, exercise_id, set_no, reps)
     values ('40000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000c', '30000000-0000-0000-0000-000000000001', 1, 12)
     on conflict (workout_id, set_no, exercise_id) do update set reps = excluded.reps $$,
  '42501', null, 'N: workout_sets Upsert (Konflikt) ohne B schlägt fehl'
);
select is((select reps::int from lifestyle.workout_sets where workout_id = '40000000-0000-0000-0000-00000000000c' and set_no = 1), 10, 'N liest den eigenen Satz unverändert');

-- R: Bestand darf nach dem Widerruf nicht geändert werden, bleibt aber lesbar
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);

select throws_ok(
  $$ update lifestyle.health_profile set height_cm = 180 where user_id = '00000000-0000-0000-0000-00000000000d' $$,
  '42501', null, 'R: health_profile UPDATE nach Widerruf schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.health_profile (user_id, height_cm) values ('00000000-0000-0000-0000-00000000000d', 180)
     on conflict (user_id) do update set height_cm = excluded.height_cm $$,
  '42501', null, 'R: health_profile Upsert (Konflikt) nach Widerruf schlägt fehl'
);
select is((select height_cm::int from lifestyle.health_profile where user_id = '00000000-0000-0000-0000-00000000000d'), 170, 'R liest die eigene health_profile-Zeile unverändert');

select throws_ok(
  $$ insert into lifestyle.body_measurements (user_id, measured_on, weight_kg) values ('00000000-0000-0000-0000-00000000000d', '2026-11-02', 80) $$,
  '42501', null, 'R: body_measurements INSERT nach Widerruf schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.body_measurements (user_id, measured_on, weight_kg) values ('00000000-0000-0000-0000-00000000000d', '2026-11-03', 80)
     on conflict (user_id, measured_on) do update set weight_kg = excluded.weight_kg $$,
  '42501', null, 'R: body_measurements Upsert (neu) nach Widerruf schlägt fehl'
);
select throws_ok(
  $$ update lifestyle.body_measurements set weight_kg = 80 where id = '20000000-0000-0000-0000-00000000000d' $$,
  '42501', null, 'R: body_measurements UPDATE nach Widerruf schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.body_measurements (user_id, measured_on, weight_kg) values ('00000000-0000-0000-0000-00000000000d', '2026-11-01', 80)
     on conflict (user_id, measured_on) do update set weight_kg = excluded.weight_kg $$,
  '42501', null, 'R: body_measurements Upsert (Konflikt) nach Widerruf schlägt fehl'
);
select is((select weight_kg::int from lifestyle.body_measurements where id = '20000000-0000-0000-0000-00000000000d'), 70, 'R liest die eigene Messung unverändert');

select throws_ok(
  $$ insert into lifestyle.workouts (id, user_id) values ('40000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000000d') $$,
  '42501', null, 'R: workouts INSERT nach Widerruf schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.workouts (id, user_id, note) values ('40000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-00000000000d', 'x')
     on conflict (id) do update set note = excluded.note $$,
  '42501', null, 'R: workouts Upsert (neu) nach Widerruf schlägt fehl'
);
select throws_ok(
  $$ update lifestyle.workouts set note = 'x' where id = '40000000-0000-0000-0000-00000000000d' $$,
  '42501', null, 'R: workouts UPDATE nach Widerruf schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.workouts (id, user_id, note) values ('40000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000d', 'x')
     on conflict (id) do update set note = excluded.note $$,
  '42501', null, 'R: workouts Upsert (Konflikt) nach Widerruf schlägt fehl'
);
select is((select note from lifestyle.workouts where id = '40000000-0000-0000-0000-00000000000d'), null, 'R liest das eigene Workout unverändert');

select throws_ok(
  $$ insert into lifestyle.workout_sets (workout_id, user_id, exercise_id, set_no, reps)
     values ('40000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000d', '30000000-0000-0000-0000-000000000001', 2, 12) $$,
  '42501', null, 'R: workout_sets INSERT nach Widerruf schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.workout_sets (workout_id, user_id, exercise_id, set_no, reps)
     values ('40000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000d', '30000000-0000-0000-0000-000000000001', 3, 12)
     on conflict (workout_id, set_no, exercise_id) do update set reps = excluded.reps $$,
  '42501', null, 'R: workout_sets Upsert (neu) nach Widerruf schlägt fehl'
);
select throws_ok(
  $$ update lifestyle.workout_sets set reps = 12 where workout_id = '40000000-0000-0000-0000-00000000000d' $$,
  '42501', null, 'R: workout_sets UPDATE nach Widerruf schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.workout_sets (workout_id, user_id, exercise_id, set_no, reps)
     values ('40000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000d', '30000000-0000-0000-0000-000000000001', 1, 12)
     on conflict (workout_id, set_no, exercise_id) do update set reps = excluded.reps $$,
  '42501', null, 'R: workout_sets Upsert (Konflikt) nach Widerruf schlägt fehl'
);
select is((select reps::int from lifestyle.workout_sets where workout_id = '40000000-0000-0000-0000-00000000000d' and set_no = 1), 10, 'R liest den eigenen Satz unverändert');

-- A (B offen): eigene Zeilen über alle Schreibwege
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$ insert into lifestyle.health_profile (user_id, height_cm) values ('00000000-0000-0000-0000-00000000000a', 170)
     on conflict (user_id) do update set height_cm = excluded.height_cm $$,
  'A: health_profile Upsert (neu) mit B'
);
select lives_ok(
  $$ insert into lifestyle.health_profile (user_id, height_cm) values ('00000000-0000-0000-0000-00000000000a', 175)
     on conflict (user_id) do update set height_cm = excluded.height_cm $$,
  'A: health_profile Upsert (Konflikt) mit B'
);
select lives_ok(
  $$ update lifestyle.health_profile set restrictions = '{}', restriction_note = null where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  'A: health_profile UPDATE mit B (Leeren)'
);
select is((select height_cm::int from lifestyle.health_profile where user_id = '00000000-0000-0000-0000-00000000000a'), 175, 'A: health_profile hat den Upsert-Wert');

select lives_ok(
  $$ insert into lifestyle.body_measurements (id, user_id, measured_on, weight_kg)
     values ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '2026-11-01', 80) $$,
  'A: body_measurements INSERT mit B'
);
select lives_ok(
  $$ insert into lifestyle.body_measurements (user_id, measured_on, weight_kg) values ('00000000-0000-0000-0000-00000000000a', '2026-11-02', 81)
     on conflict (user_id, measured_on) do update set weight_kg = excluded.weight_kg $$,
  'A: body_measurements Upsert (neu) mit B'
);
select lives_ok(
  $$ insert into lifestyle.body_measurements (user_id, measured_on, weight_kg) values ('00000000-0000-0000-0000-00000000000a', '2026-11-01', 82)
     on conflict (user_id, measured_on) do update set weight_kg = excluded.weight_kg $$,
  'A: body_measurements Upsert (Konflikt) mit B'
);
select lives_ok(
  $$ update lifestyle.body_measurements set waist_cm = 90 where id = '20000000-0000-0000-0000-00000000000a' $$,
  'A: body_measurements UPDATE mit B'
);
select is((select weight_kg::int from lifestyle.body_measurements where id = '20000000-0000-0000-0000-00000000000a'), 82, 'A: Messung hat den Upsert-Wert');

select lives_ok(
  $$ insert into lifestyle.workouts (id, user_id) values ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a') $$,
  'A: workouts INSERT mit B'
);
select lives_ok(
  $$ insert into lifestyle.workouts (id, user_id, note) values ('40000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', 'neu')
     on conflict (id) do update set note = excluded.note $$,
  'A: workouts Upsert (neu) mit B'
);
select lives_ok(
  $$ insert into lifestyle.workouts (id, user_id, note) values ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'konflikt')
     on conflict (id) do update set note = excluded.note $$,
  'A: workouts Upsert (Konflikt) mit B'
);
select lives_ok(
  $$ update lifestyle.workouts set regeneration = 'gut' where id = '40000000-0000-0000-0000-00000000000a' $$,
  'A: workouts UPDATE mit B'
);
select is((select note from lifestyle.workouts where id = '40000000-0000-0000-0000-00000000000a'), 'konflikt', 'A: Workout hat den Upsert-Wert');

select lives_ok(
  $$ insert into lifestyle.workout_sets (workout_id, user_id, exercise_id, set_no, reps)
     values ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001', 1, 10) $$,
  'A: workout_sets INSERT mit B'
);
select lives_ok(
  $$ insert into lifestyle.workout_sets (workout_id, user_id, exercise_id, set_no, reps)
     values ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001', 2, 10)
     on conflict (workout_id, set_no, exercise_id) do update set reps = excluded.reps $$,
  'A: workout_sets Upsert (neu) mit B'
);
select lives_ok(
  $$ insert into lifestyle.workout_sets (workout_id, user_id, exercise_id, set_no, reps)
     values ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001', 1, 12)
     on conflict (workout_id, set_no, exercise_id) do update set reps = excluded.reps $$,
  'A: workout_sets Upsert (Konflikt) mit B'
);
select lives_ok(
  $$ update lifestyle.workout_sets set pain = true where workout_id = '40000000-0000-0000-0000-00000000000a' and set_no = 2 $$,
  'A: workout_sets UPDATE mit B'
);
select is((select reps::int from lifestyle.workout_sets where workout_id = '40000000-0000-0000-0000-00000000000a' and set_no = 1), 12, 'A: Satz hat den Upsert-Wert');

-- A gegen S: Die eigene Einwilligung öffnet keine fremden Zeilen
select is_empty($$ select 1 from lifestyle.health_profile where user_id = '00000000-0000-0000-0000-00000000000b' $$, 'A sieht die health_profile-Zeile von S nicht');
select throws_ok(
  $$ insert into lifestyle.health_profile (user_id, height_cm) values ('00000000-0000-0000-0000-00000000000b', 180) $$,
  '42501', null, 'A: health_profile INSERT für S schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.health_profile (user_id, height_cm) values ('00000000-0000-0000-0000-00000000000b', 180)
     on conflict (user_id) do update set height_cm = excluded.height_cm $$,
  '42501', null, 'A: health_profile Upsert auf S schlägt fehl'
);
with u as (update lifestyle.health_profile set restrictions = '{}' where user_id = '00000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from u), 0::bigint, 'A: health_profile UPDATE trifft S nicht');
select throws_ok(
  $$ update lifestyle.health_profile set user_id = '00000000-0000-0000-0000-00000000000b' where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'A schiebt die health_profile-Zeile nicht auf S'
);

select is_empty($$ select 1 from lifestyle.body_measurements where user_id = '00000000-0000-0000-0000-00000000000b' $$, 'A sieht keine Messung von S');
select throws_ok(
  $$ insert into lifestyle.body_measurements (user_id, measured_on, weight_kg) values ('00000000-0000-0000-0000-00000000000b', '2026-11-02', 80) $$,
  '42501', null, 'A: body_measurements INSERT für S schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.body_measurements (user_id, measured_on, weight_kg) values ('00000000-0000-0000-0000-00000000000b', '2026-11-01', 80)
     on conflict (user_id, measured_on) do update set weight_kg = excluded.weight_kg $$,
  '42501', null, 'A: body_measurements Upsert auf S schlägt fehl'
);
with u as (update lifestyle.body_measurements set weight_kg = 1 where id = '20000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from u), 0::bigint, 'A: body_measurements UPDATE trifft S nicht');
select throws_ok(
  $$ update lifestyle.body_measurements set user_id = '00000000-0000-0000-0000-00000000000b' where id = '20000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'A schiebt die Messung nicht auf S'
);

select is_empty($$ select 1 from lifestyle.workouts where user_id = '00000000-0000-0000-0000-00000000000b' $$, 'A sieht kein Workout von S');
select throws_ok(
  $$ insert into lifestyle.workouts (user_id) values ('00000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'A: workouts INSERT für S schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.workouts (id, user_id, note) values ('40000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'x')
     on conflict (id) do update set note = excluded.note $$,
  '42501', null, 'A: workouts Upsert mit user_id von S schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.workouts (id, user_id, note) values ('40000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', 'x')
     on conflict (id) do update set note = excluded.note $$,
  '42501', null, 'A übernimmt das Workout von S nicht über einen Upsert-Konflikt'
);
with u as (update lifestyle.workouts set note = 'x' where id = '40000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from u), 0::bigint, 'A: workouts UPDATE trifft S nicht');
select throws_ok(
  $$ update lifestyle.workouts set user_id = '00000000-0000-0000-0000-00000000000b' where id = '40000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'A schiebt das Workout nicht auf S'
);

select is_empty($$ select 1 from lifestyle.workout_sets where user_id = '00000000-0000-0000-0000-00000000000b' $$, 'A sieht keinen Satz von S');
select throws_ok(
  $$ insert into lifestyle.workout_sets (workout_id, user_id, exercise_id, set_no, reps)
     values ('40000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-000000000001', 2, 8) $$,
  '42501', null, 'A: workout_sets INSERT für S schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.workout_sets (workout_id, user_id, exercise_id, set_no, reps)
     values ('40000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001', 2, 8) $$,
  '42501', null, 'A hängt keinen eigenen Satz an ein Workout von S'
);
select throws_ok(
  $$ insert into lifestyle.workout_sets (workout_id, user_id, exercise_id, set_no, reps)
     values ('40000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001', 1, 8)
     on conflict (workout_id, set_no, exercise_id) do update set reps = excluded.reps $$,
  '42501', null, 'A: workout_sets Upsert auf den Satz von S schlägt fehl'
);
with u as (update lifestyle.workout_sets set reps = 1 where workout_id = '40000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from u), 0::bigint, 'A: workout_sets UPDATE trifft S nicht');
select throws_ok(
  $$ update lifestyle.workout_sets set user_id = '00000000-0000-0000-0000-00000000000b' where workout_id = '40000000-0000-0000-0000-00000000000a' and set_no = 1 $$,
  '42501', null, 'A schiebt den Satz nicht auf S'
);
select throws_ok(
  $$ update lifestyle.workout_sets set workout_id = '40000000-0000-0000-0000-00000000000b' where workout_id = '40000000-0000-0000-0000-00000000000a' and set_no = 2 $$,
  '42501', null, 'A hängt den eigenen Satz nicht an ein Workout von S um'
);
reset role;

select is(
  (select count(*)::int from (
     select 1 from lifestyle.health_profile where user_id = '00000000-0000-0000-0000-00000000000b' and restrictions = '{knie}'
     union all select 1 from lifestyle.body_measurements where id = '20000000-0000-0000-0000-00000000000b' and weight_kg = 70
     union all select 1 from lifestyle.workouts where id = '40000000-0000-0000-0000-00000000000b' and note is null
     union all select 1 from lifestyle.workout_sets where workout_id = '40000000-0000-0000-0000-00000000000b' and reps = 10
   ) s),
  4,
  'die Zeilen von S sind unverändert'
);

-- R: Löschen bleibt nach dem Widerruf möglich (PRIVACY.md Abschnitt 3)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
with d as (delete from lifestyle.workout_sets where workout_id = '40000000-0000-0000-0000-00000000000d' returning 1)
select is((select count(*) from d), 1::bigint, 'R löscht den eigenen Satz nach dem Widerruf');
with d as (delete from lifestyle.workouts where id = '40000000-0000-0000-0000-00000000000d' returning 1)
select is((select count(*) from d), 1::bigint, 'R löscht das eigene Workout nach dem Widerruf');
with d as (delete from lifestyle.body_measurements where id = '20000000-0000-0000-0000-00000000000d' returning 1)
select is((select count(*) from d), 1::bigint, 'R löscht die eigene Messung nach dem Widerruf');
with d as (delete from lifestyle.health_profile where user_id = '00000000-0000-0000-0000-00000000000d' returning 1)
select is((select count(*) from d), 1::bigint, 'R löscht die eigene health_profile-Zeile nach dem Widerruf');

-- R erteilt B neu: Schreiben geht wieder (Widerrufene Zeile bleibt als Nachweis stehen)
select lives_ok(
  $$ insert into lifestyle.consents (user_id, kind, text_version) values ('00000000-0000-0000-0000-00000000000d', 'B', 'v2') $$,
  'R erteilt B neu'
);
select lives_ok(
  $$ insert into lifestyle.health_profile (user_id, height_cm) values ('00000000-0000-0000-0000-00000000000d', 170) $$,
  'R: health_profile INSERT nach neuer Erteilung'
);
select lives_ok(
  $$ update lifestyle.health_profile set height_cm = 171 where user_id = '00000000-0000-0000-0000-00000000000d' $$,
  'R: health_profile UPDATE nach neuer Erteilung'
);
select lives_ok(
  $$ insert into lifestyle.body_measurements (id, user_id, measured_on, weight_kg)
     values ('20000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000000d', '2026-11-05', 75) $$,
  'R: body_measurements INSERT nach neuer Erteilung'
);
select lives_ok(
  $$ update lifestyle.body_measurements set weight_kg = 76 where id = '20000000-0000-0000-0000-0000000000d2' $$,
  'R: body_measurements UPDATE nach neuer Erteilung'
);
select lives_ok(
  $$ insert into lifestyle.workouts (id, user_id) values ('40000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-00000000000d') $$,
  'R: workouts INSERT nach neuer Erteilung'
);
select lives_ok(
  $$ update lifestyle.workouts set note = 'neu' where id = '40000000-0000-0000-0000-0000000000d4' $$,
  'R: workouts UPDATE nach neuer Erteilung'
);
select lives_ok(
  $$ insert into lifestyle.workout_sets (workout_id, user_id, exercise_id, set_no, reps)
     values ('40000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-00000000000d', '30000000-0000-0000-0000-000000000001', 1, 10) $$,
  'R: workout_sets INSERT nach neuer Erteilung'
);
select lives_ok(
  $$ update lifestyle.workout_sets set reps = 11 where workout_id = '40000000-0000-0000-0000-0000000000d4' $$,
  'R: workout_sets UPDATE nach neuer Erteilung'
);

-- R widerruft erneut: sofort wieder gesperrt
select lives_ok(
  $$ update lifestyle.consents set revoked_at = now() where kind = 'B' and revoked_at is null $$,
  'R widerruft B erneut'
);
select throws_ok(
  $$ update lifestyle.health_profile set height_cm = 172 where user_id = '00000000-0000-0000-0000-00000000000d' $$,
  '42501', null, 'R: health_profile UPDATE nach erneutem Widerruf schlägt fehl'
);
select throws_ok(
  $$ update lifestyle.body_measurements set weight_kg = 77 where id = '20000000-0000-0000-0000-0000000000d2' $$,
  '42501', null, 'R: body_measurements UPDATE nach erneutem Widerruf schlägt fehl'
);
select throws_ok(
  $$ update lifestyle.workouts set note = 'x' where id = '40000000-0000-0000-0000-0000000000d4' $$,
  '42501', null, 'R: workouts UPDATE nach erneutem Widerruf schlägt fehl'
);
select throws_ok(
  $$ update lifestyle.workout_sets set reps = 12 where workout_id = '40000000-0000-0000-0000-0000000000d4' $$,
  '42501', null, 'R: workout_sets UPDATE nach erneutem Widerruf schlägt fehl'
);

-- delete_own_data bleibt auch ohne B der Weg zur vollständigen Löschung
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok($$ select lifestyle.delete_own_data() $$, 'N löscht die eigenen Daten ohne B');
reset role;
select is_empty(
  $$ select 1 from lifestyle.health_profile where user_id = '00000000-0000-0000-0000-00000000000c'
     union all select 1 from lifestyle.body_measurements where user_id = '00000000-0000-0000-0000-00000000000c'
     union all select 1 from lifestyle.workouts where user_id = '00000000-0000-0000-0000-00000000000c'
     union all select 1 from lifestyle.workout_sets where user_id = '00000000-0000-0000-0000-00000000000c' $$,
  'delete_own_data entfernt auch ohne B alles von N'
);

select * from finish();
rollback;
