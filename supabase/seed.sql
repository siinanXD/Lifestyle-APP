-- Platzhalter-Übungen für lokale Entwicklung und CI. Neutrale Technikhinweise, keine medizinischen Aussagen.
insert into lifestyle.exercises (slug, name, category, muscle_groups, equipment, technique)
values
  ('liegestuetz', 'Liegestütz', 'bodyweight', '{brust,trizeps,schulter}', '{}',
   'Hände unter den Schultern aufsetzen, Körper in einer Linie halten, Brust kontrolliert absenken und wieder hochdrücken.'),
  ('kniebeuge-koerpergewicht', 'Kniebeuge (Körpergewicht)', 'bodyweight', '{beine,gesaess}', '{}',
   'Füße schulterbreit, Gesäß nach hinten unten schieben, Knie in Richtung der Zehen, Oberkörper aufrecht, wieder aufstehen.'),
  ('plank', 'Unterarmstütz (Plank)', 'bodyweight', '{rumpf}', '{}',
   'Ellbogen unter den Schultern, Körper bildet eine Linie, Bauch und Gesäß anspannen, ruhig weiteratmen.'),
  ('kniebeuge-langhantel', 'Kniebeuge mit Langhantel', 'kraft', '{beine,gesaess,rumpf}', '{langhantel,kniebeugenstaender}',
   'Stange fest auf dem oberen Rücken, Rumpf anspannen, kontrolliert absenken und aus den Beinen aufrichten.'),
  ('bankdruecken-kurzhantel', 'Bankdrücken mit Kurzhanteln', 'kraft', '{brust,trizeps,schulter}', '{kurzhanteln,flachbank}',
   'Schulterblätter zusammenziehen, Hanteln kontrolliert senken und über der Brust wieder nach oben drücken.'),
  ('joggen', 'Joggen', 'cardio', '{beine}', '{}',
   'Aufrechte Haltung, lockere Schultern, gleichmäßiger Schritt in einem Tempo, bei dem Sprechen noch möglich ist.'),
  ('huefte-kreisen', 'Hüftkreisen', 'mobility', '{huefte}', '{}',
   'Aufrecht stehen, Hände an die Hüfte, große langsame Kreise in beide Richtungen ausführen.'),
  ('oberschenkel-dehnen', 'Oberschenkel dehnen', 'dehnen', '{beine}', '{}',
   'Im Stand die Ferse zum Gesäß führen, Knie nebeneinander halten, Position ruhig halten und gleichmäßig atmen.')
on conflict (slug) do nothing;
