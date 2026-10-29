-- Übungskatalog: reine Referenzdaten ohne Nutzerbezug, gepflegt über Migrationen und Seed.
create table lifestyle.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null
    constraint exercises_category_check
    check (category in ('kraft', 'cardio', 'bodyweight', 'mobility', 'dehnen')),
  muscle_groups text[] not null default '{}',
  equipment text[] not null default '{}', -- leer = ohne Geräte
  technique text not null,
  created_at timestamptz not null default now()
);

alter table lifestyle.exercises enable row level security;

revoke all on lifestyle.exercises from public, anon;
grant select on lifestyle.exercises to authenticated;

create policy exercises_select_authenticated on lifestyle.exercises
  for select to authenticated using (true);
