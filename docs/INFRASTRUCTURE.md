# Infrastrukturentscheidung

## Gemeinsame Infrastruktur — verbindliche Planung (24.10.2026)
- Nutzerentscheidung: Zunächst mehrere Apps auf **einem bestehenden Supabase-Projekt / einer PostgreSQL-Datenbank** betreiben; keine neue Supabase-Instanz für Lifestyle App anlegen.
- Bestandsprüfung: aktives Supabase-Projekt `Content-Agent-Lernapp` (Ref `zxielkiwgcgxyudqemjb`), weiteres Projekt `bze-online-campus` inaktiv. Noch kein `lifestyle`-Schema vorhanden.
- Geplanter Weg: Vor Implementierung Zugriffs- und Kapazitätsaudit; eigenes `lifestyle`-Schema und dedizierte minimale Datenbankrolle, RLS für jede Tabelle, getrennte Migrationen und Storage-Zugriffe, getrennte Backups/Restore-Strategie prüfen. Supabase Auth ist Teil der Stackentscheidung vom 27.10.2026 (`AGENTS.md`); Daten trennen Schema `lifestyle` und RLS; keine bestehenden App-Tabellen oder Adressen verändern.
- Next.js-Servercode und Edge Functions verbinden sich serverseitig über sicher verwaltete Secrets; keine privilegierten Schlüssel in der PWA. Self-Hosting später über selbst gehostetes Supabase.
- Vercel-Projekt erst für einen tatsächlichen Deployment-Bedarf anlegen; keine kostenpflichtigen Dienste ohne Freigabe.
- Bau freigegeben am 27.10.2026 (`AGENTS.md`). Migrationen auf das gemeinsame Projekt spielt nur Sinan ein; Vercel-Projekt und Deployment weiterhin erst bei Bedarf und mit Freigabe.

## Schema `lifestyle` im Cloud-Projekt freischalten (Aufgabe für Sinan, Label `sinan`)
- Lokal exponiert `supabase/config.toml` das Schema schon (`[api].schemas`, `extra_search_path`). Das Cloud-Projekt `zxielkiwgcgxyudqemjb` liest diese Datei nicht; ohne die Freischaltung antwortet die REST-API für `lifestyle` mit 406 (`PGRST106`).
- Voraussetzung: Die Migration `20261027210000_lifestyle_profiles.sql` ist von Sinan im Cloud-Projekt eingespielt.
- Klick: Dashboard → Project Settings → API → „Exposed schemas“ → `lifestyle` hinzufügen → Save. Bei „Extra search path“ ebenfalls `lifestyle` ergänzen.
- Prüfen: `curl -H "apikey: <anon key>" -H "Accept-Profile: lifestyle" "<project url>/rest/v1/profiles?select=id"` liefert ohne Anmeldung 401/403 (RLS, anon ohne Zugriff), nicht 406.
- Agenten führen nichts gegen die Cloud aus.

## Vercel und Migrations-Workflow (SIN-1195, 29.10.2026)
- Vercel-Projekt `lifestyle-app` (Hobby, Team siinanxds-projects) ist mit dem Repo verbunden: Preview je PR, Produktion aus `main`. Umgebungsvariablen: nur die Namen aus `.env.example`; Werte kommen aus der Supabase-Integration bzw. Infisical. Kein Service-Role-Key in Vercel, die App liest ihn nicht.
- `.github/workflows/migrate.yml` läuft bei Änderungen unter `supabase/migrations` auf `main`: prüft mit `scripts/check-migration-schemas.mjs`, dass nur Schema `lifestyle` angefasst wird (derselbe Check läuft in `build.yml` für jeden PR), und spielt fehlende Migrationen per `psql` ein. Kein `supabase db push` (das Projekt enthält Migrationen anderer Apps), kein `db reset`, kein `drop schema`.
- Einrichtung durch Sinan (Label `sinan`): GitHub-Secret `LIFESTYLE_DATABASE_URL` aus Infisical anlegen. Es muss die Session-Pooler-URL sein (GitHub-Runner haben kein IPv6, die direkte URL geht nicht) einer eigenen Rolle, die nur Schema `lifestyle` besitzt, `references` auf `auth.users` hat und in `supabase_migrations.schema_migrations` einfügen darf. Ohne Secret schlägt der Workflow sichtbar fehl.
