begin;
select plan(24);

select has_column('lifestyle', 'profiles', 'adult_confirmed_at', 'Spalte adult_confirmed_at');
select has_column('lifestyle', 'profiles', 'onboarding_completed_at', 'Spalte onboarding_completed_at');
select has_column('lifestyle', 'profiles', 'goals', 'Spalte goals');
select has_column('lifestyle', 'profiles', 'goal_note', 'Spalte goal_note');
select has_column('lifestyle', 'profiles', 'days_per_week', 'Spalte days_per_week');
select has_column('lifestyle', 'profiles', 'minutes_per_session', 'Spalte minutes_per_session');
select has_column('lifestyle', 'profiles', 'experience', 'Spalte experience');
select has_column('lifestyle', 'profiles', 'equipment', 'Spalte equipment');
select has_column('lifestyle', 'profiles', 'weight_step_kg', 'Spalte weight_step_kg');

-- Testdaten (kein Personenbezug); Zeilen nur mit id wie aus ensureProfile()
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test');
insert into lifestyle.profiles (id)
values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');

select row_eq(
  $$ select goals, equipment, weight_step_kg, onboarding_completed_at from lifestyle.profiles where id = '00000000-0000-0000-0000-00000000000a' $$,
  row('{}'::text[], '{}'::text[], 2.5::numeric(4,2), null::timestamptz),
  'Zeile nur mit id bleibt gültig und bekommt die Standardwerte'
);

-- Nutzer A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$ update lifestyle.profiles set
       adult_confirmed_at = now(), onboarding_completed_at = now(),
       goals = '{kraft,ausdauer,beweglichkeit}', goal_note = repeat('x', 200),
       days_per_week = 6, minutes_per_session = 45, experience = 'regelmaessig',
       equipment = '{kurzhanteln,matte}', weight_step_kg = 1.25
     where id = '00000000-0000-0000-0000-00000000000a' $$,
  'gültige Werte gehen durch'
);
select lives_ok(
  $$ update lifestyle.profiles set days_per_week = 1, minutes_per_session = 15, experience = 'anfaenger', weight_step_kg = 10
     where id = '00000000-0000-0000-0000-00000000000a' $$,
  'Grenzwerte 1 Tag, 15 Minuten und Stufe 10 gehen durch'
);

select throws_ok(
  $$ update lifestyle.profiles set goals = '{a,b,c,d}' where id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514', null, '4 Ziele werden abgelehnt'
);
select throws_ok(
  $$ update lifestyle.profiles set goal_note = repeat('x', 201) where id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Notiz mit 201 Zeichen wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.profiles set days_per_week = 7 where id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514', null, '7 Tage werden abgelehnt'
);
select throws_ok(
  $$ update lifestyle.profiles set days_per_week = 0 where id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514', null, '0 Tage werden abgelehnt'
);
select throws_ok(
  $$ update lifestyle.profiles set minutes_per_session = 20 where id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514', null, '20 Minuten werden abgelehnt'
);
select throws_ok(
  $$ update lifestyle.profiles set experience = 'profi' where id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Erfahrung profi wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.profiles set weight_step_kg = 0 where id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Gewichtsstufe 0 wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.profiles set weight_step_kg = 10.5 where id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'Gewichtsstufe über 10 wird abgelehnt'
);
select throws_ok(
  $$ update lifestyle.profiles set goals = null where id = '00000000-0000-0000-0000-00000000000a' $$,
  '23502', null, 'goals = null wird abgelehnt'
);

-- Fremde Zeile: weder lesen noch ändern
select is_empty(
  $$ select goals from lifestyle.profiles where id = '00000000-0000-0000-0000-00000000000b' $$,
  'A liest die Onboarding-Angaben von B nicht'
);
with u as (update lifestyle.profiles set goals = '{kraft}' where id = '00000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from u), 0::bigint, 'A ändert die Onboarding-Angaben von B nicht');
reset role;

select is(
  (select goals from lifestyle.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  '{}'::text[],
  'Zeile von B ist unverändert'
);

select * from finish();
rollback;
