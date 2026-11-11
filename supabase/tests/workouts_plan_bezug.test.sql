begin;
select plan(6);

select has_column('lifestyle', 'workouts', 'plan_id', 'workouts.plan_id existiert');
select has_column('lifestyle', 'workouts', 'plan_day_no', 'workouts.plan_day_no existiert');
select has_index('lifestyle', 'workouts', 'workouts_plan_id_started_at_idx', 'Index (plan_id, started_at desc)');

-- Testdaten (Platzhalter, keine echten Gesundheitsdaten)
insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test');
insert into lifestyle.profiles (id) values ('00000000-0000-0000-0000-00000000000a');
insert into lifestyle.training_plans (id, user_id, name)
values ('50000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Testplan');

select lives_ok(
  $$ insert into lifestyle.workouts (id, user_id, plan_id, plan_day_no)
     values ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-00000000000a', 2) $$,
  'Workout mit Planbezug lässt sich anlegen'
);
select throws_ok(
  $$ insert into lifestyle.workouts (user_id, plan_day_no) values ('00000000-0000-0000-0000-00000000000a', 8) $$,
  '23514', null, 'Tagnummer über 7 schlägt fehl'
);

delete from lifestyle.training_plans where id = '50000000-0000-0000-0000-00000000000a';
select row_eq(
  $$ select plan_id is null from lifestyle.workouts where id = '40000000-0000-0000-0000-00000000000a' $$,
  row(true),
  'Plan gelöscht: Training bleibt, der Bezug ist leer'
);

select * from finish();
rollback;
