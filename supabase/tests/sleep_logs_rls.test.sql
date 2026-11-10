begin;
select plan(22);

select has_table('lifestyle'::name, 'sleep_logs'::name);
select row_eq(
  $$ select relrowsecurity from pg_class where oid = 'lifestyle.sleep_logs'::regclass $$,
  row(true),
  'RLS ist auf sleep_logs aktiv'
);

-- Testdaten (Platzhalter)
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test');
insert into lifestyle.profiles (id)
values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
insert into lifestyle.sleep_logs (id, user_id, slept_on, duration_min)
values ('80000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '2026-11-01', 420);

-- Nutzer A, noch ohne Einwilligung B
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select throws_ok(
  $$ insert into lifestyle.sleep_logs (user_id, slept_on, duration_min)
     values ('00000000-0000-0000-0000-00000000000a', '2026-11-01', 420) $$,
  '42501', null, 'ohne Einwilligung B schlägt das Einfügen fehl'
);

reset role;
insert into lifestyle.consents (user_id, kind, text_version) values ('00000000-0000-0000-0000-00000000000a', 'B', 'v1');
set local role authenticated;

select is_empty($$ select 1 from lifestyle.sleep_logs $$, 'A sieht keinen Eintrag von B');
select throws_ok(
  $$ insert into lifestyle.sleep_logs (user_id, slept_on, duration_min)
     values ('00000000-0000-0000-0000-00000000000b', '2026-11-02', 420) $$,
  '42501', null, 'Einfügen mit fremder user_id schlägt fehl'
);
select lives_ok(
  $$ insert into lifestyle.sleep_logs (id, user_id, slept_on, duration_min, quality, note)
     values ('80000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '2026-11-01', 420, 4, 'Platzhalter'),
            ('80000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', '2026-11-02', 30, null, null) $$,
  'mit Einwilligung B speichert A eigene Einträge, Qualität darf leer sein'
);
select lives_ok(
  $$ update lifestyle.sleep_logs set duration_min = 1200 where id = '80000000-0000-0000-0000-00000000000a' $$,
  'A ändert den eigenen Eintrag'
);
with u as (update lifestyle.sleep_logs set duration_min = 60 where id = '80000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from u), 0::bigint, 'A ändert keinen Eintrag von B');
with d as (delete from lifestyle.sleep_logs where id = '80000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from d), 0::bigint, 'A löscht keinen Eintrag von B');

select throws_ok(
  $$ update lifestyle.sleep_logs set duration_min = 10 where id = '80000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Dauer 10 wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.sleep_logs set duration_min = 1300 where id = '80000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Dauer 1300 wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.sleep_logs set quality = 0 where id = '80000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Qualität 0 wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.sleep_logs set quality = 6 where id = '80000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Qualität 6 wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.sleep_logs set note = repeat('x', 201) where id = '80000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Notiz mit 201 Zeichen wird abgelehnt'
);
select throws_ok(
  $$ insert into lifestyle.sleep_logs (user_id, slept_on, duration_min)
     values ('00000000-0000-0000-0000-00000000000a', '2026-11-01', 400) $$,
  '23505', null, 'zweiter Eintrag am selben Tag wird abgelehnt'
);

-- B widerrufen: Schreiben scheitert, Lesen und Löschen bleiben möglich
reset role;
update lifestyle.consents set revoked_at = now() where user_id = '00000000-0000-0000-0000-00000000000a';
set local role authenticated;
select throws_ok(
  $$ update lifestyle.sleep_logs set duration_min = 400 where id = '80000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'nach Widerruf von B schlägt das Ändern fehl'
);
select is((select count(*) from lifestyle.sleep_logs), 2::bigint, 'nach Widerruf liest A die eigenen Einträge weiter');
with d as (delete from lifestyle.sleep_logs where id = '80000000-0000-0000-0000-0000000000a2' returning 1)
select is((select count(*) from d), 1::bigint, 'A löscht den eigenen Eintrag, auch ohne B');

select lives_ok($$ select lifestyle.delete_own_data() $$, 'A löscht die eigenen Daten');
reset role;
select results_eq(
  $$ select user_id from lifestyle.sleep_logs $$,
  $$ values ('00000000-0000-0000-0000-00000000000b'::uuid) $$,
  'delete_own_data entfernt die Einträge von A, B bleibt'
);

set local role anon;
select throws_ok($$ select * from lifestyle.sleep_logs $$, '42501', null, 'anon hat keinen Zugriff auf sleep_logs');
reset role;
select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'lifestyle' and tablename = 'sleep_logs'
       and cmd in ('INSERT', 'UPDATE', 'ALL') and coalesce(with_check, '') not like '%consents%' $$,
  'keine Schreib-Policy ohne Einwilligungsprüfung'
);

select * from finish();
rollback;
