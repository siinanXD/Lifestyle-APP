# AGENTS.md (Lifestyle App)

Status: Bau freigegeben, noch kein Code. Quellen: `README.md`, `docs/INFRASTRUCTURE.md`, Linear-Projekt „Lifestyle App“.

## Freigabe und Stack (Sinan, 27.10.2026)

- Sinan hat am 27.10.2026 die Bau-Freigabe erteilt: Agenten bauen die App autonom aus dem Linear-Projekt „Lifestyle App“ (Team SIN), ohne ihn zu fragen.
- Stack: Next.js (TypeScript, App Router) als installierbare PWA auf Vercel; Supabase für Auth, Postgres mit RLS im Schema `lifestyle`, privaten Storage, Edge Functions und pg_cron. FastAPI und Docker Compose entfallen; keine zweite API-Schicht.
- Python nur bei konkretem Bedarf (reine Python-Bibliothek, Läufe > 400 s, CPU-lastig, dauerhafter Worker), dann als schlanker Worker an einer Supabase-Queue. Vorher Entscheidung im Linear-Issue.
- Struktur: Next.js-App im Repo-Wurzelverzeichnis (`package.json` + `package-lock.json`), Datenbank in `supabase/` (Migrationen, pgTAP-/RLS-Tests in `supabase/tests`). `.github/workflows/build.yml` prüft beides, sobald es existiert.

## Regeln

1. Ein Linear-Issue, ein Branch `claude/sin-<nr>-…` oder `codex/sin-<nr>-…`, ein PR. Titel als Conventional Commit mit `(SIN-<nr>)`; Teilschritte mit `(Part of SIN-<nr>)`.
2. Erst Test, dann Code. Kleinster Diff; nichts bauen, was das Issue nicht verlangt; keine neue Abhängigkeit für ein paar Zeilen.
3. Nur Abo-Zugänge für Agenten (Claude, ChatGPT/Codex, Cursor). Keine Modell-API, kein API-Rückfall. Das gilt für den Bau. Das Produkt selbst darf Modell-APIs nutzen, nach „LLM in Produkten“ in `siinanXD/leitstand-2` `docs/stack.md`: deterministisch zuerst, jeder Aufruf in Langfuse getraced, Prompts in Langfuse, Schlüssel mit Ausgabelimit in Infisical. Keine bezahlten Dienste und kein Produktiv-Deployment ohne Freigabe.
4. Keine Secrets im Repo. Werte kommen aus Infisical (oder GitHub-Secrets); im Repo, in `.env.example` und in Doku stehen nur Namen. Neue Secrets legt Sinan an.
5. Datenbank: gemeinsames Supabase-Projekt, nur eigenes Schema `lifestyle`. Tabellen anderer Apps nie ändern (`docs/INFRASTRUCTURE.md`). RLS ist Pflicht für jede Tabelle, mit Test, dass ein Nutzer fremde Zeilen weder lesen noch ändern kann. Migrationen entstehen und laufen lokal und in CI; auf das gemeinsame Projekt spielt sie nur Sinan ein.
6. Gesundheitsdaten (DSGVO Art. 9): Datenminimierung, keine sensiblen Logs, keine Personendaten in Prompts, keine medizinischen Diagnosen. Echte Gesundheitsdaten erst speichern, wenn das Datenschutzkonzept SIN-1133 (`docs/PRIVACY.md`) von Sinan freigegeben ist; bis dahin nur Test- und Platzhalterdaten.
7. Vor dem Push: `npm run typecheck` und `npm test` grün; bei Änderungen in `supabase/` auch `supabase test db`.
8. Vor dem Öffnen oder Pushen eines PRs den Selbstcheck aus `C:\Dev\AI-Workspace\shared-rules\AI_TOOL_RULES.md` („Selbstcheck vor jedem PR“) für den eigenen Diff beantworten; offene Punkte im PR nennen.
9. Agenten tauschen Ergebnisse als strukturiertes JSON gegen ein Schema aus (`claude -p --output-format json --json-schema …`, `codex exec --output-schema …`), nie als frei zu parsender Text.
10. Gate (`.github/workflows/gate.yml`, Gate-Code von `siinanXD/leitstand-2` main): Squash-Merge bei grünem `build` und Codex-Review ohne offene Funde. `risk:low` merged bei grünem build ohne Review (nie bei Auth, RLS, Gesundheitsdaten, Secrets oder Zahlungen); dafür `risk:high`. `blockiert` stoppt das Gate. Änderungen unter `.github/` merged Sinan.
11. GitHub-/Infisical-Zugang nach `docs/github-zugang.md` in leitstand-2; keine neuen Repo-Tokens erstellen.
12. Fertig heißt: Der Nutzerweg läuft Ende zu Ende und ist belegt. Merge oder grüner Build allein reicht nicht.
