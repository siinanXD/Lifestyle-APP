-- "Konto löschen" (SIN-1198): entfernt nur die Lifestyle-Daten der angemeldeten Person.
-- Das Auth-Konto ist mit anderen Apps geteilt und bleibt bestehen.
-- Jede neue Tabelle mit Nutzerdaten braucht hier eine Zeile (siehe docs/PRIVACY.md, Abschnitt 6).
create function lifestyle.delete_own_data()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from lifestyle.water_logs where user_id = (select auth.uid());
  delete from lifestyle.profiles where id = (select auth.uid());
$$;

revoke all on function lifestyle.delete_own_data() from public, anon;
grant execute on function lifestyle.delete_own_data() to authenticated;
