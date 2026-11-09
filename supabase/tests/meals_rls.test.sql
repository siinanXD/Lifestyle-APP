begin;
select plan(23);

select has_table('lifestyle'::name, 'meals'::name);
select row_eq(
  $$ select relrowsecurity from pg_class where oid = 'lifestyle.meals'::regclass $$,
  row(true),
  'RLS ist auf meals aktiv'
);

-- Testdaten (Platzhalter)
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test');
insert into lifestyle.profiles (id)
values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
insert into lifestyle.meals (id, user_id, name)
values ('90000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Test-Mahlzeit B');

-- Nutzer A, noch ohne Einwilligung B
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select throws_ok(
  $$ insert into lifestyle.meals (user_id, name) values ('00000000-0000-0000-0000-00000000000a', 'Test-Mahlzeit') $$,
  '42501', null, 'ohne Einwilligung B schlägt das Einfügen fehl'
);

reset role;
insert into lifestyle.consents (user_id, kind, text_version) values ('00000000-0000-0000-0000-00000000000a', 'B', 'v1');
set local role authenticated;

select is_empty($$ select 1 from lifestyle.meals $$, 'A sieht keine Mahlzeit von B');
select throws_ok(
  $$ insert into lifestyle.meals (user_id, name) values ('00000000-0000-0000-0000-00000000000b', 'fremd') $$,
  '42501', null, 'Einfügen mit fremder user_id schlägt fehl'
);
select lives_ok(
  $$ insert into lifestyle.meals (id, user_id, name)
     values ('90000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Test-Mahlzeit') $$,
  'mit Einwilligung B: Eintrag ohne Nährwerte ist erlaubt'
);
select lives_ok(
  $$ insert into lifestyle.meals (id, user_id, name, amount_note, kcal, protein_g, carbs_g, fat_g, source, estimated, barcode)
     values ('90000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', 'Test-Riegel', '1 Portion', 200, 10.5, 20, 8.5, 'barcode', true, '00000000') $$,
  'A speichert eine Mahlzeit mit Nährwerten und Barcode'
);
select lives_ok(
  $$ update lifestyle.meals set kcal = 5000 where id = '90000000-0000-0000-0000-00000000000a' $$,
  'A ändert die eigene Mahlzeit'
);
with u as (update lifestyle.meals set name = 'x' where id = '90000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from u), 0::bigint, 'A ändert keine Mahlzeit von B');
with d as (delete from lifestyle.meals where id = '90000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from d), 0::bigint, 'A löscht keine Mahlzeit von B');

select throws_ok(
  $$ update lifestyle.meals set name = '' where id = '90000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'leerer Name wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.meals set kcal = 6000 where id = '90000000-0000-0000-0000-00000000000a' $$,
  '23514', null, '6000 kcal werden abgelehnt'
);
select throws_ok(
  $$ update lifestyle.meals set source = 'scan' where id = '90000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Quelle scan wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.meals set barcode = 'abc' where id = '90000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Barcode abc wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.meals set barcode = '1234567' where id = '90000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Barcode mit 7 Ziffern wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.meals set protein_g = 1001 where id = '90000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Eiweiß über 1000 g wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.meals set amount_note = repeat('x', 61) where id = '90000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Mengenangabe mit 61 Zeichen wird abgelehnt'
);

-- B widerrufen: Schreiben scheitert, Lesen und Löschen bleiben möglich
reset role;
update lifestyle.consents set revoked_at = now() where user_id = '00000000-0000-0000-0000-00000000000a';
set local role authenticated;
select throws_ok(
  $$ update lifestyle.meals set kcal = 100 where id = '90000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'nach Widerruf von B schlägt das Ändern fehl'
);
select is((select count(*) from lifestyle.meals), 2::bigint, 'nach Widerruf liest A die eigenen Mahlzeiten weiter');
with d as (delete from lifestyle.meals where id = '90000000-0000-0000-0000-0000000000a2' returning 1)
select is((select count(*) from d), 1::bigint, 'A löscht die eigene Mahlzeit, auch ohne B');

select lives_ok($$ select lifestyle.delete_own_data() $$, 'A löscht die eigenen Daten');
reset role;
select results_eq(
  $$ select user_id from lifestyle.meals $$,
  $$ values ('00000000-0000-0000-0000-00000000000b'::uuid) $$,
  'delete_own_data entfernt die Mahlzeiten von A, B bleibt'
);

set local role anon;
select throws_ok($$ select * from lifestyle.meals $$, '42501', null, 'anon hat keinen Zugriff auf meals');
reset role;

select * from finish();
rollback;
