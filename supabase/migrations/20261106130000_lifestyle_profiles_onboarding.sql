-- SIN-1257: Angaben aus docs/ONBOARDING.md. Alle neuen Spalten sind nullable oder haben einen Default,
-- damit bestehende Zeilen (nur id aus ensureProfile) gültig bleiben. Policies bleiben unverändert.
alter table lifestyle.profiles
  add column adult_confirmed_at timestamptz,
  add column onboarding_completed_at timestamptz,
  add column goals text[] not null default '{}'
    constraint profiles_goals_max3 check (coalesce(array_length(goals, 1), 0) <= 3),
  add column goal_note text
    constraint profiles_goal_note_len check (char_length(goal_note) <= 200),
  add column days_per_week smallint
    constraint profiles_days_per_week_range check (days_per_week between 1 and 6),
  add column minutes_per_session smallint
    constraint profiles_minutes_per_session_values check (minutes_per_session in (15, 30, 45, 60)),
  add column experience text
    constraint profiles_experience_values check (experience in ('anfaenger', 'wiedereinstieg', 'regelmaessig')),
  -- Werte frei, bis das Geräte-Issue (SIN-1271) sie festlegt.
  add column equipment text[] not null default '{}',
  -- Kleinste Gewichtsstufe für die Progressionsregel (lib/training/progression.ts).
  add column weight_step_kg numeric(4,2) not null default 2.5
    constraint profiles_weight_step_kg_range check (weight_step_kg > 0 and weight_step_kg <= 10);
