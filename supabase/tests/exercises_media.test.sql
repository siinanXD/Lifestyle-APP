begin;
select plan(13);

select has_column('lifestyle', 'exercises', 'media_webm', 'media_webm existiert');
select has_column('lifestyle', 'exercises', 'variant_of', 'variant_of existiert');
select has_column('lifestyle', 'exercises', 'joints', 'joints existiert');
select has_column('lifestyle', 'exercises', 'difficulty', 'difficulty existiert');

-- Testdaten (eigene Slugs, unabhängig vom Seed)
insert into lifestyle.exercises (slug, name, category, technique, joints, difficulty)
values ('test-grund', 'Test Grundübung', 'kraft', 'Testtext', '{knie,huefte}', 2);

select lives_ok(
  $$ insert into lifestyle.exercises (slug, name, category, technique, variant_of)
     values ('test-variante', 'Test Variante', 'bodyweight', 'Testtext', 'test-grund') $$,
  'Variante einer vorhandenen Übung lässt sich anlegen'
);
select throws_ok(
  $$ insert into lifestyle.exercises (slug, name, category, technique, variant_of)
     values ('test-selbst', 'Test', 'kraft', 'Testtext', 'test-selbst') $$,
  '23514', null, 'Selbstverweis wird abgelehnt'
);
select throws_ok(
  $$ insert into lifestyle.exercises (slug, name, category, technique, variant_of)
     values ('test-unbekannt', 'Test', 'kraft', 'Testtext', 'gibt-es-nicht') $$,
  '23503', null, 'unbekannte Variante wird abgelehnt'
);
select throws_ok(
  $$ insert into lifestyle.exercises (slug, name, category, technique, difficulty) values ('test-d0', 'Test', 'kraft', 'Testtext', 0) $$,
  '23514', null, 'difficulty 0 wird abgelehnt'
);
select throws_ok(
  $$ insert into lifestyle.exercises (slug, name, category, technique, difficulty) values ('test-d4', 'Test', 'kraft', 'Testtext', 4) $$,
  '23514', null, 'difficulty 4 wird abgelehnt'
);
select throws_ok(
  $$ insert into lifestyle.exercises (slug, name, category, technique, joints) values ('test-herz', 'Test', 'kraft', 'Testtext', '{herz}') $$,
  '23514', null, 'Gelenk herz wird abgelehnt'
);

-- authenticated: lesen ja, schreiben nein
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select results_eq(
  $$ select joints, difficulty, variant_of from lifestyle.exercises where slug = 'test-grund' $$,
  $$ values ('{knie,huefte}'::text[], 2::smallint, null::text) $$,
  'authenticated liest die neuen Spalten'
);
select throws_ok(
  $$ update lifestyle.exercises set difficulty = 3 where slug = 'test-grund' $$,
  '42501', null, 'authenticated darf nicht schreiben'
);

-- anon: kein Zugriff
set local role anon;
select throws_ok($$ select joints from lifestyle.exercises $$, '42501', null, 'anon hat keinen Zugriff');

select * from finish();
rollback;
