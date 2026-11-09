-- Art. 9: Gesundheitsdaten schreibt nur, wer Einwilligung B offen hat (docs/PRIVACY.md Abschnitt 3; gleiche Regel wie hatEinwilligung).
-- ALTER POLICY ersetzt nur WITH CHECK: Permissive Policies sind ODER-verknüpft, eine zusätzliche ließe den reinen Besitz-Pfad offen.
-- USING bleibt Besitz, damit ein Schreiben ohne B mit 42501 scheitert statt still 0 Zeilen zu ändern. Lesen und Löschen bleiben ohne B möglich.
alter policy health_profile_insert_own on lifestyle.health_profile
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from lifestyle.consents c where c.user_id = (select auth.uid()) and c.kind = 'B' and c.revoked_at is null)
  );
alter policy health_profile_update_own on lifestyle.health_profile
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from lifestyle.consents c where c.user_id = (select auth.uid()) and c.kind = 'B' and c.revoked_at is null)
  );

alter policy body_measurements_insert_own on lifestyle.body_measurements
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from lifestyle.consents c where c.user_id = (select auth.uid()) and c.kind = 'B' and c.revoked_at is null)
  );
alter policy body_measurements_update_own on lifestyle.body_measurements
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from lifestyle.consents c where c.user_id = (select auth.uid()) and c.kind = 'B' and c.revoked_at is null)
  );

alter policy workouts_insert_own on lifestyle.workouts
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from lifestyle.consents c where c.user_id = (select auth.uid()) and c.kind = 'B' and c.revoked_at is null)
  );
alter policy workouts_update_own on lifestyle.workouts
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from lifestyle.consents c where c.user_id = (select auth.uid()) and c.kind = 'B' and c.revoked_at is null)
  );

alter policy workout_sets_insert_own on lifestyle.workout_sets
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from lifestyle.workouts w where w.id = workout_id and w.user_id = (select auth.uid()))
    and exists (select 1 from lifestyle.consents c where c.user_id = (select auth.uid()) and c.kind = 'B' and c.revoked_at is null)
  );
alter policy workout_sets_update_own on lifestyle.workout_sets
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from lifestyle.workouts w where w.id = workout_id and w.user_id = (select auth.uid()))
    and exists (select 1 from lifestyle.consents c where c.user_id = (select auth.uid()) and c.kind = 'B' and c.revoked_at is null)
  );
