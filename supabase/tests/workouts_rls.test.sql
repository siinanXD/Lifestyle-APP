begin;
select plan(22);

select has_table('lifestyle'::name, 'workouts'::name);
select has_table('lifestyle'::name, 'workout_sets'::name);
select row_eq(
  $$ select bool_and(relrowsecurity) from pg_class where oid in ('lifestyle.workouts'::regclass, 'lifestyle.workout_sets'::regclass) $$,
  row(true),
  'RLS ist auf workouts und workout_sets aktiv'
);
select has_index('lifestyle', 'workout_sets', 'workout_sets_user_id_exercise_id_created_at_idx', 'Index (user_id, exercise_id, created_at desc)');

-- Testdaten (Platzhalter, keine echten Gesundheitsdaten)
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test');
insert into lifestyle.exercises (id, slug, name, category, technique)
values ('30000000-0000-0000-0000-000000000001', 'test-rudern', 'Test-Rudern', 'kraft', 'Platzhalter.');
insert into lifestyle.workouts (id, user_id) values ('40000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b');
insert into lifestyle.workout_sets (workout_id, user_id, exercise_id, set_no, reps)
values ('40000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-000000000001', 1, 10);

-- Nutzer A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is_empty($$ select 1 from lifestyle.workouts $$, 'A sieht kein Workout von B');
select is_empty($$ select 1 from lifestyle.workout_sets $$, 'A sieht keinen Satz von B');
select throws_ok(
  $$ insert into lifestyle.workouts (user_id) values ('00000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'Workout mit fremder user_id schlägt fehl'
);
select lives_ok(
  $$ insert into lifestyle.workouts (id, user_id) values ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a') $$,
  'A legt ein eigenes Workout an (Client setzt die UUID)'
);
select lives_ok(
  $$ insert into lifestyle.workout_sets (workout_id, user_id, exercise_id, set_no, reps, weight_kg)
     values ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001', 1, 12, 20),
            ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001', 2, 12, 20) $$,
  'A speichert eigene Sätze'
);
select throws_ok(
  $$ insert into lifestyle.workout_sets (workout_id, user_id, exercise_id, set_no, reps)
     values ('40000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001', 2, 5) $$,
  '42501', null, 'A hängt keinen Satz an ein Workout von B'
);
select lives_ok(
  $$ update lifestyle.workouts set ended_at = now(), regeneration = 'gut' where id = '40000000-0000-0000-0000-00000000000a' $$,
  'A beendet das eigene Workout'
);
with u as (update lifestyle.workouts set note = 'x' where id = '40000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from u), 0::bigint, 'A ändert kein Workout von B');
with u as (update lifestyle.workout_sets set reps = 1 where workout_id = '40000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from u), 0::bigint, 'A ändert keinen Satz von B');

select throws_ok(
  $$ insert into lifestyle.workout_sets (workout_id, user_id, exercise_id, set_no, reps)
     values ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001', 3, -1) $$,
  '23514', null, 'Wiederholungen -1 werden abgelehnt'
);
select throws_ok(
  $$ insert into lifestyle.workout_sets (workout_id, user_id, exercise_id, set_no, reps, technique)
     values ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001', 3, 8, 'super') $$,
  '23514', null, 'Technik super wird abgelehnt'
);
select throws_ok(
  $$ insert into lifestyle.workout_sets (workout_id, user_id, exercise_id, set_no, reps)
     values ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001', 1, 8) $$,
  '23505', null, 'doppelter set_no je Übung wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.workouts set ended_at = started_at - interval '1 minute' where id = '40000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Ende vor dem Start wird abgelehnt'
);

-- Löschen eines Workouts löscht seine Sätze
insert into lifestyle.workouts (id, user_id) values ('40000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a');
insert into lifestyle.workout_sets (workout_id, user_id, exercise_id, set_no, reps)
values ('40000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001', 1, 5);
delete from lifestyle.workouts where id = '40000000-0000-0000-0000-0000000000a2';
select is_empty(
  $$ select 1 from lifestyle.workout_sets where workout_id = '40000000-0000-0000-0000-0000000000a2' $$,
  'Löschen eines Workouts löscht seine Sätze'
);

select lives_ok($$ select lifestyle.delete_own_data() $$, 'A löscht die eigenen Daten');
reset role;
select results_eq(
  $$ select user_id from lifestyle.workouts union all select user_id from lifestyle.workout_sets $$,
  $$ values ('00000000-0000-0000-0000-00000000000b'::uuid), ('00000000-0000-0000-0000-00000000000b'::uuid) $$,
  'delete_own_data entfernt Workouts und Sätze von A, B bleibt'
);

set local role anon;
select throws_ok($$ select * from lifestyle.workouts $$, '42501', null, 'anon hat keinen Zugriff auf workouts');
select throws_ok($$ select * from lifestyle.workout_sets $$, '42501', null, 'anon hat keinen Zugriff auf workout_sets');
reset role;

select * from finish();
rollback;
