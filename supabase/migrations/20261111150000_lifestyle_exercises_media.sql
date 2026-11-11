-- SIN-1266: Spalten für Übungskarten (Animation, Varianten) und die Plan-Engine (belastete Körperbereiche).
-- RLS bleibt unverändert: nur select für authenticated, kein Schreibrecht.
alter table lifestyle.exercises
  add column media_webm text,   -- relative Pfade oder URLs; leer = keine Animation
  add column media_webp text,
  add column media_poster text,
  -- leichtere/schwerere Variante derselben Grundübung
  add column variant_of text references lifestyle.exercises (slug),
  -- Körperbereiche, die die Übung belastet. Neutrale Metadaten, keine medizinische Aussage.
  add column joints text[] not null default '{}'
    constraint exercises_joints_check check (joints <@ array['knie', 'ruecken', 'schulter', 'handgelenk', 'huefte']::text[]),
  add column difficulty smallint not null default 1
    constraint exercises_difficulty_check check (difficulty between 1 and 3),
  add constraint exercises_variant_not_self check (variant_of <> slug);
