begin;
select plan(24);

select has_table('lifestyle'::name, 'training_plans'::name);
select has_table('lifestyle'::name, 'plan_items'::name);
select row_eq(
  $$ select bool_and(relrowsecurity) from pg_class where oid in ('lifestyle.training_plans'::regclass, 'lifestyle.plan_items'::regclass) $$,
  row(true),
  'RLS ist auf training_plans und plan_items aktiv'
);

-- Testdaten (Platzhalter)
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test');
-- Die Profilzeile legt ensureProfile() beim Login an; die Pläne hängen daran.
insert into lifestyle.profiles (id)
values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
insert into lifestyle.exercises (id, slug, name, category, technique)
values ('30000000-0000-0000-0000-000000000001', 'test-plan-rudern', 'Test-Rudern', 'kraft', 'Platzhalter.');
insert into lifestyle.training_plans (id, user_id, name)
values ('50000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Plan B');
insert into lifestyle.plan_items (plan_id, user_id, day_no, position, exercise_id, sets, rep_min, rep_max)
values ('50000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 1, 1, '30000000-0000-0000-0000-000000000001', 3, 8, 12);

-- Nutzer A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is_empty($$ select 1 from lifestyle.training_plans $$, 'A sieht keinen Plan von B');
select is_empty($$ select 1 from lifestyle.plan_items $$, 'A sieht keine Position von B');
select throws_ok(
  $$ insert into lifestyle.training_plans (user_id, name) values ('00000000-0000-0000-0000-00000000000b', 'fremd') $$,
  '42501', null, 'Plan mit fremder user_id schlägt fehl'
);
select lives_ok(
  $$ insert into lifestyle.training_plans (id, user_id, name)
     values ('50000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Plan A') $$,
  'A legt einen eigenen Plan an'
);
select lives_ok(
  $$ insert into lifestyle.plan_items (plan_id, user_id, day_no, position, exercise_id, sets, rep_min, rep_max)
     values ('50000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 1, 1, '30000000-0000-0000-0000-000000000001', 3, 8, 12),
            ('50000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 1, 2, '30000000-0000-0000-0000-000000000001', 2, 10, 10) $$,
  'A speichert eigene Positionen'
);
select throws_ok(
  $$ insert into lifestyle.plan_items (plan_id, user_id, day_no, position, exercise_id, sets, rep_min, rep_max)
     values ('50000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', 2, 1, '30000000-0000-0000-0000-000000000001', 3, 8, 12) $$,
  '42501', null, 'A hängt keine Position an einen Plan von B'
);
select lives_ok(
  $$ update lifestyle.training_plans set name = 'Plan A neu' where id = '50000000-0000-0000-0000-00000000000a' $$,
  'A ändert den eigenen Plan'
);
with u as (update lifestyle.training_plans set name = 'x' where id = '50000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from u), 0::bigint, 'A ändert keinen Plan von B');
with u as (update lifestyle.plan_items set sets = 1 where plan_id = '50000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from u), 0::bigint, 'A ändert keine Position von B');

select throws_ok(
  $$ insert into lifestyle.training_plans (user_id, name) values ('00000000-0000-0000-0000-00000000000a', 'zweiter aktiver') $$,
  '23505', null, 'zweiter aktiver Plan wird abgelehnt'
);
select lives_ok(
  $$ insert into lifestyle.training_plans (id, user_id, name, active)
     values ('50000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', 'alter Plan', false) $$,
  'ein weiterer, nicht aktiver Plan ist erlaubt'
);
select throws_ok(
  $$ insert into lifestyle.plan_items (plan_id, user_id, day_no, position, exercise_id, sets, rep_min, rep_max)
     values ('50000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 2, 1, '30000000-0000-0000-0000-000000000001', 3, 12, 8) $$,
  '23514', null, 'rep_min > rep_max wird abgelehnt'
);
select throws_ok(
  $$ insert into lifestyle.plan_items (plan_id, user_id, day_no, position, exercise_id, sets, rep_min, rep_max)
     values ('50000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 8, 1, '30000000-0000-0000-0000-000000000001', 3, 8, 12) $$,
  '23514', null, 'Tag 8 wird abgelehnt'
);
select throws_ok(
  $$ insert into lifestyle.plan_items (plan_id, user_id, day_no, position, exercise_id, sets, rep_min, rep_max)
     values ('50000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 2, 1, '30000000-0000-0000-0000-000000000001', 0, 8, 12) $$,
  '23514', null, 'sets 0 wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.training_plans set name = '' where id = '50000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'leerer Name wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.training_plans set source = 'ki' where id = '50000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Quelle ki wird abgelehnt'
);

-- Löschen eines Plans löscht seine Positionen
insert into lifestyle.plan_items (plan_id, user_id, day_no, position, exercise_id, sets, rep_min, rep_max)
values ('50000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', 1, 1, '30000000-0000-0000-0000-000000000001', 3, 8, 12);
delete from lifestyle.training_plans where id = '50000000-0000-0000-0000-0000000000a2';
select is_empty(
  $$ select 1 from lifestyle.plan_items where plan_id = '50000000-0000-0000-0000-0000000000a2' $$,
  'Löschen eines Plans löscht seine Positionen'
);

select lives_ok($$ select lifestyle.delete_own_data() $$, 'A löscht die eigenen Daten');
reset role;
select results_eq(
  $$ select user_id from lifestyle.training_plans
     union all
     select user_id from lifestyle.plan_items $$,
  $$ values ('00000000-0000-0000-0000-00000000000b'::uuid), ('00000000-0000-0000-0000-00000000000b'::uuid) $$,
  'delete_own_data entfernt Pläne und Positionen von A, B bleibt'
);

set local role anon;
select throws_ok($$ select * from lifestyle.training_plans $$, '42501', null, 'anon hat keinen Zugriff auf training_plans');
select throws_ok($$ select * from lifestyle.plan_items $$, '42501', null, 'anon hat keinen Zugriff auf plan_items');
reset role;

select * from finish();
rollback;
