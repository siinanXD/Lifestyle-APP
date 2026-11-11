-- SIN-1285: Ein Training merkt sich, aus welchem Plan und welchem Plantag es gestartet wurde.
-- Pläne haben keine eigene Tag-Tabelle (plan_items.day_no), deshalb Plan-id plus Tagnummer statt plan_day_id.
-- Wird der Plan gelöscht, bleibt das Training bestehen und verliert nur den Bezug.
alter table lifestyle.workouts
  add column plan_id uuid references lifestyle.training_plans (id) on delete set null,
  add column plan_day_no smallint check (plan_day_no between 1 and 7);

-- „Heute dran“ sucht den zuletzt absolvierten Plantag eines Plans.
create index workouts_plan_id_started_at_idx on lifestyle.workouts (plan_id, started_at desc) where plan_id is not null;
