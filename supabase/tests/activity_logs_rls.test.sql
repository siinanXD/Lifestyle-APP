begin;
select plan(22);

select has_table('lifestyle'::name, 'activity_logs'::name);
select row_eq(
  $$ select relrowsecurity from pg_class where oid = 'lifestyle.activity_logs'::regclass $$,
  row(true),
  'RLS ist auf activity_logs aktiv'
);

-- Testdaten (Platzhalter)
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test');
insert into lifestyle.profiles (id)
values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
insert into lifestyle.activity_logs (id, user_id, activity, category, duration_min)
values ('60000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Test-Schwimmen', 'cardio', 30);

-- Nutzer A, noch ohne Einwilligung B
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select throws_ok(
  $$ insert into lifestyle.activity_logs (user_id, activity, category, duration_min)
     values ('00000000-0000-0000-0000-00000000000a', 'Test-Joggen', 'cardio', 30) $$,
  '42501', null, 'ohne Einwilligung B schlägt das Einfügen fehl'
);

reset role;
insert into lifestyle.consents (user_id, kind, text_version) values ('00000000-0000-0000-0000-00000000000a', 'B', 'v1');
set local role authenticated;

select is_empty($$ select 1 from lifestyle.activity_logs $$, 'A sieht keine Aktivität von B');
select throws_ok(
  $$ insert into lifestyle.activity_logs (user_id, activity, category, duration_min)
     values ('00000000-0000-0000-0000-00000000000b', 'fremd', 'cardio', 30) $$,
  '42501', null, 'Einfügen mit fremder user_id schlägt fehl'
);
select lives_ok(
  $$ insert into lifestyle.activity_logs (id, user_id, activity, category, duration_min, distance_km, effort, note)
     values ('60000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Test-Joggen', 'cardio', 30, 5.25, 6, 'Platzhalter'),
            ('60000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', 'Test-Yoga', 'mobility', 20, null, null, null) $$,
  'mit Einwilligung B speichert A eigene Aktivitäten'
);
select lives_ok(
  $$ update lifestyle.activity_logs set duration_min = 45 where id = '60000000-0000-0000-0000-00000000000a' $$,
  'A ändert die eigene Aktivität'
);
with u as (update lifestyle.activity_logs set duration_min = 1 where id = '60000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from u), 0::bigint, 'A ändert keine Aktivität von B');
with d as (delete from lifestyle.activity_logs where id = '60000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from d), 0::bigint, 'A löscht keine Aktivität von B');

select throws_ok(
  $$ update lifestyle.activity_logs set duration_min = 0 where id = '60000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Dauer 0 wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.activity_logs set category = 'fussball' where id = '60000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Kategorie fussball wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.activity_logs set effort = 11 where id = '60000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Anstrengung 11 wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.activity_logs set activity = '' where id = '60000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'leere Aktivität wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.activity_logs set distance_km = 1001 where id = '60000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Distanz über 1000 km wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.activity_logs set note = repeat('x', 201) where id = '60000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Notiz mit 201 Zeichen wird abgelehnt'
);

-- B widerrufen: Schreiben scheitert, Lesen und Löschen bleiben möglich
reset role;
update lifestyle.consents set revoked_at = now() where user_id = '00000000-0000-0000-0000-00000000000a';
set local role authenticated;
select throws_ok(
  $$ update lifestyle.activity_logs set duration_min = 50 where id = '60000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'nach Widerruf von B schlägt das Ändern fehl'
);
select is((select count(*) from lifestyle.activity_logs), 2::bigint, 'nach Widerruf liest A die eigenen Aktivitäten weiter');
with d as (delete from lifestyle.activity_logs where id = '60000000-0000-0000-0000-0000000000a2' returning 1)
select is((select count(*) from d), 1::bigint, 'A löscht die eigene Aktivität, auch ohne B');

select lives_ok($$ select lifestyle.delete_own_data() $$, 'A löscht die eigenen Daten');
reset role;
select results_eq(
  $$ select user_id from lifestyle.activity_logs $$,
  $$ values ('00000000-0000-0000-0000-00000000000b'::uuid) $$,
  'delete_own_data entfernt die Aktivitäten von A, B bleibt'
);

set local role anon;
select throws_ok($$ select * from lifestyle.activity_logs $$, '42501', null, 'anon hat keinen Zugriff auf activity_logs');
reset role;
select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'lifestyle' and tablename = 'activity_logs'
       and cmd in ('INSERT', 'UPDATE', 'ALL') and coalesce(with_check, '') not like '%consents%' $$,
  'keine Schreib-Policy ohne Einwilligungsprüfung'
);

select * from finish();
rollback;
