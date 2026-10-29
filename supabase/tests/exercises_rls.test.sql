begin;
select plan(11);

select has_table('lifestyle'::name, 'exercises'::name);
select row_eq(
  $$ select relrowsecurity from pg_class where oid = 'lifestyle.exercises'::regclass $$,
  row(true),
  'RLS ist auf lifestyle.exercises aktiv'
);

-- Testdaten (eigene Slugs, unabhängig vom Seed)
insert into lifestyle.exercises (slug, name, category, muscle_groups, equipment, technique)
values
  ('test-liegestuetz', 'Test Liegestütz', 'bodyweight', '{brust,trizeps}', '{}', 'Testtext'),
  ('test-kniebeuge', 'Test Kniebeuge', 'kraft', '{beine}', '{langhantel}', 'Testtext');

-- Einschränkungen (als Tabellenbesitzer, vor dem Rollenwechsel)
select throws_ok(
  $$ insert into lifestyle.exercises (slug, name, category, technique)
     values ('test-ungueltig', 'Test', 'yoga', 'Testtext') $$,
  '23514',
  null,
  'ungültige category wird abgelehnt'
);
select throws_ok(
  $$ insert into lifestyle.exercises (slug, name, category, technique)
     values ('test-liegestuetz', 'Doppelt', 'kraft', 'Testtext') $$,
  '23505',
  null,
  'slug ist eindeutig'
);
select lives_ok(
  $$ insert into lifestyle.exercises (slug, name, category, technique)
     select 'test-kat-' || c, 'Test ' || c, c, 'Testtext'
     from unnest(array['kraft','cardio','bodyweight','mobility','dehnen']) as c $$,
  'alle fünf erlaubten Kategorien werden akzeptiert'
);

-- angemeldeter Nutzer
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select results_eq(
  $$ select slug from lifestyle.exercises where slug like 'test-%' and slug not like 'test-kat-%' order by slug $$,
  $$ values ('test-kniebeuge'::text), ('test-liegestuetz') $$,
  'angemeldeter Nutzer liest den Katalog'
);
select throws_ok(
  $$ insert into lifestyle.exercises (slug, name, category, technique)
     values ('test-neu', 'Neu', 'kraft', 'Testtext') $$,
  '42501',
  null,
  'authenticated darf nicht einfügen'
);
select throws_ok(
  $$ update lifestyle.exercises set name = 'geändert' where slug = 'test-kniebeuge' $$,
  '42501',
  null,
  'authenticated darf nicht ändern'
);
select throws_ok(
  $$ delete from lifestyle.exercises where slug = 'test-kniebeuge' $$,
  '42501',
  null,
  'authenticated darf nicht löschen'
);
reset role;

-- anon
set local role anon;
select throws_ok(
  $$ select * from lifestyle.exercises $$,
  '42501',
  null,
  'anon kann den Katalog nicht lesen'
);
reset role;

select is(
  (select has_table_privilege('anon', 'lifestyle.exercises', 'select')),
  false,
  'anon hat kein SELECT-Recht auf lifestyle.exercises'
);

select * from finish();
rollback;
