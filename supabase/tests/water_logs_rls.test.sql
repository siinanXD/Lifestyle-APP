begin;
select plan(12);

select has_table('lifestyle'::name, 'water_logs'::name);
select row_eq(
  $$ select relrowsecurity from pg_class where oid = 'lifestyle.water_logs'::regclass $$,
  row(true),
  'RLS ist auf lifestyle.water_logs aktiv'
);

-- Testdaten (kein Personenbezug)
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test');
insert into lifestyle.water_logs (id, user_id, amount_ml)
values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 250),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 500);

-- Nutzer A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select results_eq(
  $$ select id from lifestyle.water_logs $$,
  $$ values ('10000000-0000-0000-0000-00000000000a'::uuid) $$,
  'A sieht nur die eigene Zeile'
);

select throws_ok(
  $$ insert into lifestyle.water_logs (user_id, amount_ml) values ('00000000-0000-0000-0000-00000000000b', 250) $$,
  '42501',
  null,
  'A legt keine Zeile für B an'
);

select lives_ok(
  $$ insert into lifestyle.water_logs (user_id, amount_ml) values ('00000000-0000-0000-0000-00000000000a', 300) $$,
  'A legt eine eigene Zeile an'
);

select throws_ok(
  $$ insert into lifestyle.water_logs (user_id, amount_ml) values ('00000000-0000-0000-0000-00000000000a', 0) $$,
  '23514',
  null,
  'amount_ml = 0 wird abgelehnt'
);
select throws_ok(
  $$ insert into lifestyle.water_logs (user_id, amount_ml) values ('00000000-0000-0000-0000-00000000000a', 5001) $$,
  '23514',
  null,
  'amount_ml = 5001 wird abgelehnt'
);

select throws_ok(
  $$ update lifestyle.water_logs set amount_ml = 1 $$,
  '42501',
  null,
  'A darf keine Zeile ändern'
);

with d as (delete from lifestyle.water_logs where id = '10000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from d), 0::bigint, 'A löscht die Zeile von B nicht');

with d as (delete from lifestyle.water_logs where id = '10000000-0000-0000-0000-00000000000a' returning 1)
select is((select count(*) from d), 1::bigint, 'A löscht die eigene Zeile');
reset role;

-- B hat weiterhin genau seine Zeile
select is(
  (select count(*) from lifestyle.water_logs where user_id = '00000000-0000-0000-0000-00000000000b'),
  1::bigint,
  'Zeile von B ist unverändert vorhanden'
);

-- anon
set local role anon;
select throws_ok(
  $$ select * from lifestyle.water_logs $$,
  '42501',
  null,
  'anon hat keinen Zugriff'
);
reset role;

select * from finish();
rollback;
