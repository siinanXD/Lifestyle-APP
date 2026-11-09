begin;
select plan(19);

select has_table('lifestyle'::name, 'health_profile'::name);
select row_eq(
  $$ select relrowsecurity from pg_class where oid = 'lifestyle.health_profile'::regclass $$,
  row(true),
  'RLS ist auf lifestyle.health_profile aktiv'
);

-- Testdaten (Platzhalter, keine echten Gesundheitsdaten)
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test');
-- Die Profilzeile legt ensureProfile() beim Login an; die Gesundheitstabellen hängen daran.
insert into lifestyle.profiles (id)
values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
insert into lifestyle.health_profile (user_id, restrictions)
values ('00000000-0000-0000-0000-00000000000b', '{knie}');
insert into lifestyle.consents (user_id, kind, text_version)
values ('00000000-0000-0000-0000-00000000000a', 'B', 'v1');

-- Nutzer A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is_empty($$ select 1 from lifestyle.health_profile $$, 'A sieht die Zeile von B nicht');
select throws_ok(
  $$ insert into lifestyle.health_profile (user_id) values ('00000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'Einfügen mit fremder user_id schlägt fehl'
);
select lives_ok(
  $$ insert into lifestyle.health_profile (user_id, restrictions, restriction_note, height_cm)
     values ('00000000-0000-0000-0000-00000000000a', '{ruecken,schulter}', 'Platzhalter', 180) $$,
  'A legt die eigene Zeile an'
);
select results_eq(
  $$ select user_id from lifestyle.health_profile $$,
  $$ values ('00000000-0000-0000-0000-00000000000a'::uuid) $$,
  'A liest nur die eigene Zeile'
);
select lives_ok(
  $$ update lifestyle.health_profile set height_cm = 100 where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  'A ändert die eigene Zeile (Grenzwert 100 cm)'
);
with u as (update lifestyle.health_profile set restrictions = '{}' where user_id = '00000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from u), 0::bigint, 'A ändert die Zeile von B nicht');
select throws_ok(
  $$ update lifestyle.health_profile set user_id = '00000000-0000-0000-0000-00000000000b' where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'A schiebt die eigene Zeile nicht auf B'
);

select throws_ok(
  $$ update lifestyle.health_profile set restrictions = '{herz}' where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Einschränkung herz wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.health_profile set height_cm = 50 where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Größe 50 wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.health_profile set height_cm = 251 where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Größe 251 wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.health_profile set restriction_note = repeat('x', 201) where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Notiz mit 201 Zeichen wird abgelehnt'
);

with d as (delete from lifestyle.health_profile where user_id = '00000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from d), 0::bigint, 'A löscht die Zeile von B nicht');

with d as (delete from lifestyle.health_profile where user_id = '00000000-0000-0000-0000-00000000000a' returning 1)
select is((select count(*) from d), 1::bigint, 'A löscht die eigene Zeile (Widerruf B)');
select lives_ok(
  $$ insert into lifestyle.health_profile (user_id) values ('00000000-0000-0000-0000-00000000000a') $$,
  'A legt die eigene Zeile wieder an'
);

-- delete_own_data() entfernt die Zeile von A, B bleibt
select lives_ok($$ select lifestyle.delete_own_data() $$, 'A löscht die eigenen Daten');
reset role;
select results_eq(
  $$ select user_id from lifestyle.health_profile $$,
  $$ values ('00000000-0000-0000-0000-00000000000b'::uuid) $$,
  'delete_own_data entfernt nur die Zeile von A'
);

set local role anon;
select throws_ok($$ select * from lifestyle.health_profile $$, '42501', null, 'anon hat keinen Zugriff');
reset role;

select * from finish();
rollback;
