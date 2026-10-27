begin;
select plan(10);

select has_schema('lifestyle');
select has_table('lifestyle'::name, 'profiles'::name);
select row_eq(
  $$ select relrowsecurity from pg_class where oid = 'lifestyle.profiles'::regclass $$,
  row(true),
  'RLS ist auf lifestyle.profiles aktiv'
);

-- Testdaten (kein Personenbezug)
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test');
insert into lifestyle.profiles (id, display_name)
values
  ('00000000-0000-0000-0000-00000000000a', 'A'),
  ('00000000-0000-0000-0000-00000000000b', 'B');

-- Nutzer A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select results_eq(
  $$ select id from lifestyle.profiles $$,
  $$ values ('00000000-0000-0000-0000-00000000000a'::uuid) $$,
  'A sieht nur die eigene Zeile'
);

update lifestyle.profiles set display_name = 'A neu' where id = '00000000-0000-0000-0000-00000000000b';
select is_empty(
  $$ select 1 from lifestyle.profiles where display_name = 'A neu' $$,
  'A ändert die Zeile von B nicht'
);

update lifestyle.profiles set display_name = 'A neu' where id = '00000000-0000-0000-0000-00000000000a';
select is(
  (select display_name from lifestyle.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'A neu',
  'A ändert die eigene Zeile'
);

select throws_ok(
  $$ insert into lifestyle.profiles (id, display_name) values ('00000000-0000-0000-0000-00000000000b', 'x') $$,
  '42501',
  null,
  'A legt keine Zeile für B an'
);

select throws_ok(
  $$ delete from lifestyle.profiles where id = '00000000-0000-0000-0000-00000000000b' $$,
  '42501',
  null,
  'A darf nichts löschen'
);
reset role;

-- anon
set local role anon;
select throws_ok(
  $$ select * from lifestyle.profiles $$,
  '42501',
  null,
  'anon hat keinen Zugriff'
);
reset role;

select is(
  (select has_schema_privilege('anon', 'lifestyle', 'usage')),
  false,
  'anon hat keine USAGE auf Schema lifestyle'
);

select * from finish();
rollback;
