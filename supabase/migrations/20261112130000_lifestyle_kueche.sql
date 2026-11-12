-- SIN-1624: Küche für Smart Cooking (SIN-1473): Geräte, Vorrat, Einkaufsliste.
-- Kein Art.-9-Inhalt (Einwilligung A „Profil & Gewohnheiten“ laut lib/consent/kategorien.ts), deshalb ohne Einwilligung B.
-- user_id hängt an lifestyle.profiles, nicht an auth.users: Die Migrationsrolle darf auth.users nicht referenzieren (SIN-1612).

-- Küchengeräte: fester Schlüssel (lib/kochen/geraete.ts), je Gerät höchstens eine Zeile.
create table lifestyle.kitchen_appliances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references lifestyle.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'herd', 'ofen', 'mikrowelle', 'airfryer', 'mixer', 'puerierstab', 'wasserkocher', 'toaster',
    'reiskocher', 'kontaktgrill', 'dampfgarer', 'kuechenmaschine'
  )),
  model text check (char_length(model) <= 80), -- freiwillig, z. B. Hersteller und Modell
  created_at timestamptz not null default now(),
  constraint kitchen_appliances_one_per_kind unique (user_id, kind)
);

-- Vorrat: was im Kühlschrank, Gefrierfach oder Vorratsschrank liegt.
create table lifestyle.pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references lifestyle.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- Schlüssel aus der Zutatenliste (lib/kochen/zutaten.ts); leer = unbekannte Zutat, zählt für Rezepte nicht
  ingredient_key text check (ingredient_key ~ '^[a-z0-9_]{1,40}$'),
  amount numeric(8,2) check (amount >= 0 and amount <= 100000),
  unit text check (unit in ('stueck', 'g', 'kg', 'ml', 'l', 'packung', 'dose', 'glas', 'bund')),
  location text not null default 'kuehlschrank' check (location in ('kuehlschrank', 'gefrierfach', 'vorrat')),
  best_before date, -- nur von der Person selbst eingetragen, nie aus einem Foto geraten
  source text not null default 'manuell' check (source in ('manuell', 'bon_foto', 'bon_mail', 'einkauf')),
  created_at timestamptz not null default now()
);

create index pantry_items_user_id_idx on lifestyle.pantry_items (user_id);

-- Einkaufsliste: fehlende Zutaten aus Rezepten oder eigene Einträge.
create table lifestyle.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references lifestyle.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  ingredient_key text check (ingredient_key ~ '^[a-z0-9_]{1,40}$'),
  amount numeric(8,2) check (amount >= 0 and amount <= 100000),
  unit text check (unit in ('stueck', 'g', 'kg', 'ml', 'l', 'packung', 'dose', 'glas', 'bund')),
  done boolean not null default false,
  recipe_slug text check (recipe_slug ~ '^[a-z0-9-]{1,60}$'),
  created_at timestamptz not null default now()
);

create index shopping_items_user_id_idx on lifestyle.shopping_items (user_id);

alter table lifestyle.kitchen_appliances enable row level security;
alter table lifestyle.pantry_items enable row level security;
alter table lifestyle.shopping_items enable row level security;

revoke all on lifestyle.kitchen_appliances, lifestyle.pantry_items, lifestyle.shopping_items from public, anon;
grant select, insert, update, delete on lifestyle.kitchen_appliances, lifestyle.pantry_items, lifestyle.shopping_items to authenticated;

create policy kitchen_appliances_select_own on lifestyle.kitchen_appliances
  for select to authenticated using ((select auth.uid()) = user_id);
create policy kitchen_appliances_insert_own on lifestyle.kitchen_appliances
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy kitchen_appliances_update_own on lifestyle.kitchen_appliances
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy kitchen_appliances_delete_own on lifestyle.kitchen_appliances
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy pantry_items_select_own on lifestyle.pantry_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy pantry_items_insert_own on lifestyle.pantry_items
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy pantry_items_update_own on lifestyle.pantry_items
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy pantry_items_delete_own on lifestyle.pantry_items
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy shopping_items_select_own on lifestyle.shopping_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy shopping_items_insert_own on lifestyle.shopping_items
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy shopping_items_update_own on lifestyle.shopping_items
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy shopping_items_delete_own on lifestyle.shopping_items
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Kontolöschung deckt die neuen Tabellen ab (Lösch-Wächter SIN-1253).
create or replace function lifestyle.delete_own_data()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from lifestyle.shopping_items where user_id = (select auth.uid());
  delete from lifestyle.pantry_items where user_id = (select auth.uid());
  delete from lifestyle.kitchen_appliances where user_id = (select auth.uid());
  delete from lifestyle.water_logs where user_id = (select auth.uid());
  delete from lifestyle.habit_checks where user_id = (select auth.uid());
  delete from lifestyle.habits where user_id = (select auth.uid());
  delete from lifestyle.meals where user_id = (select auth.uid());
  delete from lifestyle.sleep_logs where user_id = (select auth.uid());
  delete from lifestyle.comeback_checkins where user_id = (select auth.uid());
  delete from lifestyle.activity_logs where user_id = (select auth.uid());
  delete from lifestyle.plan_items where user_id = (select auth.uid());
  delete from lifestyle.training_plans where user_id = (select auth.uid());
  delete from lifestyle.workout_sets where user_id = (select auth.uid());
  delete from lifestyle.workouts where user_id = (select auth.uid());
  delete from lifestyle.body_measurements where user_id = (select auth.uid());
  delete from lifestyle.health_profile where user_id = (select auth.uid());
  delete from lifestyle.profiles where id = (select auth.uid());
  delete from lifestyle.consents where user_id = (select auth.uid());
$$;
