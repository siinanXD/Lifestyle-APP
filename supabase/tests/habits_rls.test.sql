begin;
select plan(22);

select has_table('lifestyle'::name, 'habits'::name);
select has_table('lifestyle'::name, 'habit_checks'::name);
select row_eq(
  $$ select bool_and(relrowsecurity) from pg_class where oid in ('lifestyle.habits'::regclass, 'lifestyle.habit_checks'::regclass) $$,
  row(true),
  'RLS ist auf habits und habit_checks aktiv'
);

-- Testdaten (Platzhalter)
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test');
insert into lifestyle.profiles (id)
values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
insert into lifestyle.habits (id, user_id, name)
values ('a0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Gewohnheit B');
insert into lifestyle.habit_checks (habit_id, user_id, day)
values ('a0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '2026-11-01');

-- Nutzer A (Gewohnheiten sind kein Art.-9-Inhalt: keine Einwilligung B nötig)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is_empty($$ select 1 from lifestyle.habits $$, 'A sieht keine Gewohnheit von B');
select is_empty($$ select 1 from lifestyle.habit_checks $$, 'A sieht kein Häkchen von B');
select throws_ok(
  $$ insert into lifestyle.habits (user_id, name) values ('00000000-0000-0000-0000-00000000000b', 'fremd') $$,
  '42501', null, 'Gewohnheit mit fremder user_id schlägt fehl'
);
select lives_ok(
  $$ insert into lifestyle.habits (id, user_id, name)
     values ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Gewohnheit A'),
            ('a0000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', 'Gewohnheit A2') $$,
  'A legt eigene Gewohnheiten an'
);
select lives_ok(
  $$ insert into lifestyle.habit_checks (habit_id, user_id, day)
     values ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '2026-11-01'),
            ('a0000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', '2026-11-01') $$,
  'A hakt eigene Gewohnheiten ab'
);
select throws_ok(
  $$ insert into lifestyle.habit_checks (habit_id, user_id, day)
     values ('a0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', '2026-11-02') $$,
  '42501', null, 'Häkchen an fremder Gewohnheit schlägt fehl'
);
select lives_ok(
  $$ update lifestyle.habits set name = 'Gewohnheit A neu', active = false, sort = 2 where id = 'a0000000-0000-0000-0000-00000000000a' $$,
  'A ändert die eigene Gewohnheit'
);
with u as (update lifestyle.habits set name = 'x' where id = 'a0000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from u), 0::bigint, 'A ändert keine Gewohnheit von B');
select throws_ok(
  $$ update lifestyle.habit_checks set day = '2026-11-03' where habit_id = 'a0000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'Häkchen lassen sich nicht ändern, nur setzen und löschen'
);
with d as (delete from lifestyle.habit_checks where habit_id = 'a0000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from d), 0::bigint, 'A löscht kein Häkchen von B');
with d as (delete from lifestyle.habits where id = 'a0000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from d), 0::bigint, 'A löscht keine Gewohnheit von B');

select throws_ok(
  $$ update lifestyle.habits set name = '' where id = 'a0000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'leerer Name wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.habits set name = repeat('x', 61) where id = 'a0000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Name mit 61 Zeichen wird abgelehnt'
);
select throws_ok(
  $$ insert into lifestyle.habit_checks (habit_id, user_id, day)
     values ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '2026-11-01') $$,
  '23505', null, 'doppeltes Häkchen am selben Tag wird abgelehnt'
);

-- Löschen einer Gewohnheit löscht ihre Häkchen
delete from lifestyle.habits where id = 'a0000000-0000-0000-0000-0000000000a2';
select is_empty(
  $$ select 1 from lifestyle.habit_checks where habit_id = 'a0000000-0000-0000-0000-0000000000a2' $$,
  'Löschen einer Gewohnheit löscht ihre Häkchen'
);

select lives_ok($$ select lifestyle.delete_own_data() $$, 'A löscht die eigenen Daten');
reset role;
select results_eq(
  $$ select user_id from lifestyle.habits
     union all
     select user_id from lifestyle.habit_checks $$,
  $$ values ('00000000-0000-0000-0000-00000000000b'::uuid), ('00000000-0000-0000-0000-00000000000b'::uuid) $$,
  'delete_own_data entfernt Gewohnheiten und Häkchen von A, B bleibt'
);

set local role anon;
select throws_ok($$ select * from lifestyle.habits $$, '42501', null, 'anon hat keinen Zugriff auf habits');
select throws_ok($$ select * from lifestyle.habit_checks $$, '42501', null, 'anon hat keinen Zugriff auf habit_checks');
reset role;

select * from finish();
rollback;
