begin;
select plan(18);

select has_table('lifestyle'::name, 'body_measurements'::name);
select row_eq(
  $$ select relrowsecurity from pg_class where oid = 'lifestyle.body_measurements'::regclass $$,
  row(true),
  'RLS ist auf lifestyle.body_measurements aktiv'
);
select has_index('lifestyle', 'body_measurements', 'body_measurements_user_id_measured_on_idx', 'Index (user_id, measured_on desc)');

-- Testdaten (Platzhalter, keine echten Gesundheitsdaten)
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test');
insert into lifestyle.body_measurements (id, user_id, measured_on, weight_kg)
values ('20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '2026-11-01', 70);

-- Nutzer A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is_empty($$ select 1 from lifestyle.body_measurements $$, 'A sieht keine Zeile von B');
select throws_ok(
  $$ insert into lifestyle.body_measurements (user_id, weight_kg) values ('00000000-0000-0000-0000-00000000000b', 80) $$,
  '42501', null, 'Einfügen mit fremder user_id schlägt fehl'
);
select lives_ok(
  $$ insert into lifestyle.body_measurements (id, user_id, measured_on, weight_kg, waist_cm)
     values ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '2026-11-01', 80, 90) $$,
  'A trägt eine eigene Messung ein'
);
select lives_ok(
  $$ insert into lifestyle.body_measurements (user_id, measured_on, thigh_cm) values ('00000000-0000-0000-0000-00000000000a', '2026-11-02', 55) $$,
  'eine Messung nur mit Umfang (ohne Gewicht) geht durch'
);
select is((select count(*)::int from lifestyle.body_measurements), 2, 'A sieht nur die eigenen zwei Zeilen');
select lives_ok(
  $$ update lifestyle.body_measurements set weight_kg = 79.5 where id = '20000000-0000-0000-0000-00000000000a' $$,
  'A ändert die eigene Zeile'
);
with u as (update lifestyle.body_measurements set weight_kg = 1 where id = '20000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from u), 0::bigint, 'A ändert die Zeile von B nicht');
with d as (delete from lifestyle.body_measurements where id = '20000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from d), 0::bigint, 'A löscht die Zeile von B nicht');

select throws_ok(
  $$ insert into lifestyle.body_measurements (user_id, measured_on) values ('00000000-0000-0000-0000-00000000000a', '2026-11-03') $$,
  '23514', null, 'leere Messung wird abgelehnt'
);
select throws_ok(
  $$ insert into lifestyle.body_measurements (user_id, measured_on, weight_kg) values ('00000000-0000-0000-0000-00000000000a', '2026-11-04', 5) $$,
  '23514', null, 'Gewicht 5 wird abgelehnt'
);
select throws_ok(
  $$ insert into lifestyle.body_measurements (user_id, measured_on, chest_cm) values ('00000000-0000-0000-0000-00000000000a', '2026-11-05', 400) $$,
  '23514', null, 'Umfang 400 wird abgelehnt'
);
select throws_ok(
  $$ insert into lifestyle.body_measurements (user_id, measured_on, weight_kg) values ('00000000-0000-0000-0000-00000000000a', '2026-11-01', 81) $$,
  '23505', null, 'zweite Messung am selben Tag wird abgelehnt'
);

select lives_ok($$ select lifestyle.delete_own_data() $$, 'A löscht die eigenen Daten');
reset role;
select results_eq(
  $$ select user_id from lifestyle.body_measurements $$,
  $$ values ('00000000-0000-0000-0000-00000000000b'::uuid) $$,
  'delete_own_data entfernt die Zeilen von A, B bleibt'
);

set local role anon;
select throws_ok($$ select * from lifestyle.body_measurements $$, '42501', null, 'anon hat keinen Zugriff');
reset role;

select * from finish();
rollback;
