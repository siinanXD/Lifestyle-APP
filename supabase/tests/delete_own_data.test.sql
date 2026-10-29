begin;
select plan(7);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@example.test');
insert into lifestyle.profiles (id)
values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
insert into lifestyle.water_logs (user_id, amount_ml)
values
  ('00000000-0000-0000-0000-00000000000a', 250),
  ('00000000-0000-0000-0000-00000000000b', 300);

-- Konto aus einer anderen App (C): ohne Profil, sieht nichts Fremdes, legt das eigene an.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is_empty($$ select 1 from lifestyle.profiles $$, 'C ohne Profil sieht keine fremden Profile');
select is_empty($$ select 1 from lifestyle.water_logs $$, 'C sieht keine fremden Wasser-Einträge');
select lives_ok(
  $$ insert into lifestyle.profiles (id) values ('00000000-0000-0000-0000-00000000000c') $$,
  'C legt beim ersten Login das eigene Profil an'
);

-- A löscht die eigenen Daten
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select lifestyle.delete_own_data() $$, 'A löscht die eigenen Daten');
reset role;

select is_empty(
  $$ select 1 from lifestyle.profiles where id = '00000000-0000-0000-0000-00000000000a'
     union all select 1 from lifestyle.water_logs where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  'von A ist in keiner Tabelle etwas übrig'
);
select is(
  (select count(*)::int from lifestyle.profiles where id <> '00000000-0000-0000-0000-00000000000a')
  + (select count(*)::int from lifestyle.water_logs where user_id <> '00000000-0000-0000-0000-00000000000a'),
  3,
  'die Daten von B und C bleiben'
);

set local role anon;
select throws_ok($$ select lifestyle.delete_own_data() $$, '42501', null, 'anon darf die Funktion nicht aufrufen');
reset role;

select * from finish();
rollback;
