begin;
select plan(23);

select has_table('lifestyle'::name, 'consents'::name);
select row_eq(
  $$ select relrowsecurity from pg_class where oid = 'lifestyle.consents'::regclass $$,
  row(true),
  'RLS ist auf lifestyle.consents aktiv'
);

-- Testdaten (kein Personenbezug)
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test');
insert into lifestyle.consents (id, user_id, kind, text_version)
values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'A', 'v1'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'A', 'v1');

-- Nutzer A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select results_eq(
  $$ select id from lifestyle.consents $$,
  $$ values ('10000000-0000-0000-0000-00000000000a'::uuid) $$,
  'A sieht nur die eigene Zeile'
);

select throws_ok(
  $$ insert into lifestyle.consents (user_id, kind, text_version) values ('00000000-0000-0000-0000-00000000000b', 'B', 'v1') $$,
  '42501',
  null,
  'A legt keine Einwilligung für B an'
);

select lives_ok(
  $$ insert into lifestyle.consents (user_id, kind, text_version) values ('00000000-0000-0000-0000-00000000000a', 'B', 'v1') $$,
  'A erteilt eine eigene Einwilligung'
);

select throws_ok(
  $$ insert into lifestyle.consents (user_id, kind, text_version) values ('00000000-0000-0000-0000-00000000000a', 'F', 'v1') $$,
  '23514',
  null,
  'kind = F wird abgelehnt'
);

select throws_ok(
  $$ insert into lifestyle.consents (user_id, kind, text_version) values ('00000000-0000-0000-0000-00000000000a', 'B', 'v2') $$,
  '23505',
  null,
  'zwei offene Einwilligungen gleicher Art werden abgelehnt'
);

select throws_ok(
  $$ insert into lifestyle.consents (user_id, kind) values ('00000000-0000-0000-0000-00000000000a', 'C') $$,
  '23502',
  null,
  'ohne Textversion wird abgelehnt'
);

-- Ändern: nur revoked_at, nur auf eigenen, noch offenen Zeilen
with u as (update lifestyle.consents set revoked_at = now() where id = '10000000-0000-0000-0000-00000000000b' returning 1)
select is((select count(*) from u), 0::bigint, 'A widerruft die Einwilligung von B nicht');

select throws_ok(
  $$ update lifestyle.consents set user_id = '00000000-0000-0000-0000-00000000000b' where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501',
  null,
  'A schiebt keine eigene Zeile auf B'
);
select throws_ok(
  $$ update lifestyle.consents set text_version = 'v9' where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501',
  null,
  'A ändert die Textversion nicht nachträglich'
);

select lives_ok(
  $$ update lifestyle.consents set revoked_at = now() where id = '10000000-0000-0000-0000-00000000000a' $$,
  'A widerruft die eigene Einwilligung'
);
with u as (update lifestyle.consents set revoked_at = null where id = '10000000-0000-0000-0000-00000000000a' returning 1)
select is((select count(*) from u), 0::bigint, 'ein Widerruf lässt sich nicht zurücknehmen');

select lives_ok(
  $$ insert into lifestyle.consents (user_id, kind, text_version) values ('00000000-0000-0000-0000-00000000000a', 'A', 'v2') $$,
  'nach dem Widerruf ist eine neue Erteilung derselben Art möglich'
);

select throws_ok(
  $$ delete from lifestyle.consents $$,
  '42501',
  null,
  'A darf keine Einwilligung löschen'
);

-- Nutzer B
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select results_eq(
  $$ select id from lifestyle.consents $$,
  $$ values ('10000000-0000-0000-0000-00000000000b'::uuid) $$,
  'B sieht keine Zeile von A'
);
reset role;

select is(
  (select count(*) from lifestyle.consents where id = '10000000-0000-0000-0000-00000000000b' and revoked_at is null),
  1::bigint,
  'Einwilligung von B ist unverändert offen'
);

-- anon
set local role anon;
select throws_ok($$ select * from lifestyle.consents $$, '42501', null, 'anon liest nichts');
select throws_ok(
  $$ insert into lifestyle.consents (user_id, kind, text_version) values ('00000000-0000-0000-0000-00000000000a', 'D', 'v1') $$,
  '42501',
  null,
  'anon schreibt nichts'
);
reset role;

-- delete_own_data()
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select lifestyle.delete_own_data() $$, 'A löscht die eigenen Daten');
reset role;

select is_empty(
  $$ select 1 from lifestyle.consents where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  'delete_own_data() entfernt alle Einwilligungen von A'
);
select is(
  (select count(*) from lifestyle.consents where user_id = '00000000-0000-0000-0000-00000000000b'),
  1::bigint,
  'die Einwilligung von B bleibt'
);

-- Löschen des Kontos entfernt die Einwilligungen ebenfalls (on delete cascade)
delete from auth.users where id = '00000000-0000-0000-0000-00000000000b';
select is_empty(
  $$ select 1 from lifestyle.consents where user_id = '00000000-0000-0000-0000-00000000000b' $$,
  'Kontolöschung entfernt die Einwilligungen (cascade)'
);

select * from finish();
rollback;
