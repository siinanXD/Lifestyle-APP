begin;
select plan(24);

select has_table('lifestyle'::name, 'kitchen_appliances'::name);
select has_table('lifestyle'::name, 'pantry_items'::name);
select has_table('lifestyle'::name, 'shopping_items'::name);
select row_eq(
  $$ select bool_and(relrowsecurity) from pg_class
     where oid in ('lifestyle.kitchen_appliances'::regclass, 'lifestyle.pantry_items'::regclass, 'lifestyle.shopping_items'::regclass) $$,
  row(true),
  'RLS ist auf allen drei Küchentabellen aktiv'
);

-- Testdaten (Platzhalter)
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test');
insert into lifestyle.profiles (id)
values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
insert into lifestyle.kitchen_appliances (user_id, kind) values ('00000000-0000-0000-0000-00000000000b', 'ofen');
insert into lifestyle.pantry_items (id, user_id, name) values ('b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Milch B');
insert into lifestyle.shopping_items (id, user_id, name) values ('c0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Brot B');

-- Nutzer A (kein Art.-9-Inhalt: keine Einwilligung B nötig)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is_empty(
  $$ select 1 from lifestyle.kitchen_appliances union all select 1 from lifestyle.pantry_items union all select 1 from lifestyle.shopping_items $$,
  'A sieht keine Küchendaten von B'
);
select throws_ok(
  $$ insert into lifestyle.pantry_items (user_id, name) values ('00000000-0000-0000-0000-00000000000b', 'fremd') $$,
  '42501', null, 'Vorrat mit fremder user_id schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.kitchen_appliances (user_id, kind) values ('00000000-0000-0000-0000-00000000000b', 'herd') $$,
  '42501', null, 'Gerät mit fremder user_id schlägt fehl'
);
select throws_ok(
  $$ insert into lifestyle.shopping_items (user_id, name) values ('00000000-0000-0000-0000-00000000000b', 'fremd') $$,
  '42501', null, 'Einkaufseintrag mit fremder user_id schlägt fehl'
);

select lives_ok(
  $$ insert into lifestyle.kitchen_appliances (user_id, kind, model)
     values ('00000000-0000-0000-0000-00000000000a', 'ofen', 'Testmodell'), ('00000000-0000-0000-0000-00000000000a', 'airfryer', null) $$,
  'A legt eigene Geräte an (dasselbe Gerät wie B ist erlaubt)'
);
select lives_ok(
  $$ insert into lifestyle.pantry_items (id, user_id, name, ingredient_key, amount, unit, location, best_before)
     values ('b0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Eier', 'ei', 6, 'stueck', 'kuehlschrank', '2026-12-01') $$,
  'A legt eigenen Vorrat an'
);
select lives_ok(
  $$ insert into lifestyle.shopping_items (id, user_id, name, ingredient_key, amount, unit, recipe_slug)
     values ('c0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Reis', 'reis', 500, 'g', 'haehnchen-reis-pfanne') $$,
  'A legt einen eigenen Einkaufseintrag an'
);
select lives_ok(
  $$ update lifestyle.pantry_items set amount = 4 where id = 'b0000000-0000-0000-0000-00000000000a';
     update lifestyle.shopping_items set done = true where id = 'c0000000-0000-0000-0000-00000000000a' $$,
  'A ändert eigene Zeilen'
);
with u as (update lifestyle.pantry_items set name = 'x' where id = 'b0000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from u), 0::bigint, 'A ändert keinen Vorrat von B');
with d as (delete from lifestyle.shopping_items where id = 'c0000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from d), 0::bigint, 'A löscht keinen Einkaufseintrag von B');
with d as (delete from lifestyle.kitchen_appliances where user_id = '00000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from d), 0::bigint, 'A löscht kein Gerät von B');

-- Grenzen der Spalten
select throws_ok(
  $$ insert into lifestyle.kitchen_appliances (user_id, kind) values ('00000000-0000-0000-0000-00000000000a', 'ofen') $$,
  '23505', null, 'dasselbe Gerät zweimal wird abgelehnt'
);
select throws_ok(
  $$ insert into lifestyle.kitchen_appliances (user_id, kind) values ('00000000-0000-0000-0000-00000000000a', 'raclette') $$,
  '23514', null, 'unbekanntes Gerät wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.pantry_items set amount = -1 where id = 'b0000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'negative Menge wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.pantry_items set unit = 'tasse' where id = 'b0000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'unbekannte Einheit wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.pantry_items set location = 'keller' where id = 'b0000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'unbekannter Ort wird abgelehnt'
);
select throws_ok(
  $$ insert into lifestyle.shopping_items (user_id, name) values ('00000000-0000-0000-0000-00000000000a', '') $$,
  '23514', null, 'leerer Name wird abgelehnt'
);

select lives_ok($$ select lifestyle.delete_own_data() $$, 'A löscht die eigenen Daten');
reset role;
select results_eq(
  $$ select user_id from lifestyle.kitchen_appliances
     union all select user_id from lifestyle.pantry_items
     union all select user_id from lifestyle.shopping_items $$,
  $$ values ('00000000-0000-0000-0000-00000000000b'::uuid), ('00000000-0000-0000-0000-00000000000b'::uuid), ('00000000-0000-0000-0000-00000000000b'::uuid) $$,
  'delete_own_data entfernt die Küchendaten von A, B bleibt'
);

set local role anon;
select throws_ok(
  $$ select * from lifestyle.pantry_items $$, '42501', null, 'anon hat keinen Zugriff auf pantry_items'
);
reset role;

select * from finish();
rollback;
