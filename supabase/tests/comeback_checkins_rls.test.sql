begin;
select plan(19);

select has_table('lifestyle'::name, 'comeback_checkins'::name);
select row_eq(
  $$ select relrowsecurity from pg_class where oid = 'lifestyle.comeback_checkins'::regclass $$,
  row(true),
  'RLS ist auf comeback_checkins aktiv'
);

-- Testdaten (Platzhalter)
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test');
insert into lifestyle.profiles (id)
values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
insert into lifestyle.comeback_checkins (id, user_id, days_since_last, level)
values ('70000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 14, 2);

-- Nutzer A, noch ohne Einwilligung B
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select throws_ok(
  $$ insert into lifestyle.comeback_checkins (user_id, days_since_last, level)
     values ('00000000-0000-0000-0000-00000000000a', 10, 1) $$,
  '42501', null, 'ohne Einwilligung B schlägt das Einfügen fehl'
);

reset role;
insert into lifestyle.consents (user_id, kind, text_version) values ('00000000-0000-0000-0000-00000000000a', 'B', 'v1');
set local role authenticated;

select is_empty($$ select 1 from lifestyle.comeback_checkins $$, 'A sieht keine Angabe von B');
select throws_ok(
  $$ insert into lifestyle.comeback_checkins (user_id, days_since_last, level)
     values ('00000000-0000-0000-0000-00000000000b', 10, 1) $$,
  '42501', null, 'Einfügen mit fremder user_id schlägt fehl'
);
select lives_ok(
  $$ insert into lifestyle.comeback_checkins (id, user_id, days_since_last, level)
     values ('70000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 10, 1) $$,
  'mit Einwilligung B: leere Angaben (nur Pflichtfelder) sind erlaubt'
);
select lives_ok(
  $$ insert into lifestyle.comeback_checkins (id, user_id, days_since_last, reason, feeling, level)
     values ('70000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', 0, 'urlaub', 'gut', 0) $$,
  'A speichert eine Angabe mit Grund und Befinden'
);
select throws_ok(
  $$ update lifestyle.comeback_checkins set level = 2 where id = '70000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'Update schlägt fehl (Angaben sind Momentaufnahmen)'
);
with d as (delete from lifestyle.comeback_checkins where id = '70000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from d), 0::bigint, 'A löscht keine Angabe von B');

select throws_ok(
  $$ insert into lifestyle.comeback_checkins (user_id, days_since_last, reason, level)
     values ('00000000-0000-0000-0000-00000000000a', 10, 'freitext', 1) $$,
  '23514', null, 'Grund freitext wird abgelehnt'
);
select throws_ok(
  $$ insert into lifestyle.comeback_checkins (user_id, days_since_last, feeling, level)
     values ('00000000-0000-0000-0000-00000000000a', 10, 'super', 1) $$,
  '23514', null, 'Befinden super wird abgelehnt'
);
select throws_ok(
  $$ insert into lifestyle.comeback_checkins (user_id, days_since_last, level)
     values ('00000000-0000-0000-0000-00000000000a', 10, 4) $$,
  '23514', null, 'Stufe 4 wird abgelehnt'
);
select throws_ok(
  $$ insert into lifestyle.comeback_checkins (user_id, days_since_last, level)
     values ('00000000-0000-0000-0000-00000000000a', -1, 1) $$,
  '23514', null, 'Tage -1 werden abgelehnt'
);

-- B widerrufen: Schreiben scheitert, Lesen und Löschen bleiben möglich
reset role;
update lifestyle.consents set revoked_at = now() where user_id = '00000000-0000-0000-0000-00000000000a';
set local role authenticated;
select throws_ok(
  $$ insert into lifestyle.comeback_checkins (user_id, days_since_last, level)
     values ('00000000-0000-0000-0000-00000000000a', 10, 1) $$,
  '42501', null, 'nach Widerruf von B schlägt das Einfügen fehl'
);
select is((select count(*) from lifestyle.comeback_checkins), 2::bigint, 'nach Widerruf liest A die eigenen Angaben weiter');
with d as (delete from lifestyle.comeback_checkins where id = '70000000-0000-0000-0000-0000000000a2' returning 1)
select is((select count(*) from d), 1::bigint, 'A löscht die eigene Angabe, auch ohne B');

select lives_ok($$ select lifestyle.delete_own_data() $$, 'A löscht die eigenen Daten');
reset role;
select results_eq(
  $$ select user_id from lifestyle.comeback_checkins $$,
  $$ values ('00000000-0000-0000-0000-00000000000b'::uuid) $$,
  'delete_own_data entfernt die Angaben von A, B bleibt'
);

set local role anon;
select throws_ok($$ select * from lifestyle.comeback_checkins $$, '42501', null, 'anon hat keinen Zugriff auf comeback_checkins');
reset role;

select * from finish();
rollback;
