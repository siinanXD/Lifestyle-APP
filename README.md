# Lifestyle App — AI Lifestyle Coach

**Status: Bau freigegeben (27.10.2026), noch keine Implementierung.** Geschlossene Beta für 10 kostenlose Testpersonen. Next.js-PWA auf Vercel, Supabase (Schema `lifestyle`, RLS), später optionales Premium-Abo.

## Vision
Eine ruhige, moderne, schnelle und unkomplizierte Lifestyle-App: gesund leben, besser aussehen, fit werden, ohne Perfektionsdruck. Nutzer beschreiben Ziele in Alltagssprache (z. B. breitere Schultern, mehr Ausdauer). Der Coach erklärt wenige wirksame Übungen verständlich und respektvoll.

## Produktumfang
- Onboarding: Ziele, Zeitbudget, Erfahrung, Einschränkungen, Geräte, freiwillige Daten.
- Sport: Kraft, Cardio, Bodyweight, Mobility, Dehnen; generisches Tracking für weitere Sportarten.
- Geräte per Foto erkennen, Ergebnisse bestätigen/korrigieren; manuelle Eingabe immer möglich.
- Trainingspläne aus Zielen, vorhandenen Geräten und Übungen ohne Geräte.
- Übungskarten: automatisch und stumm loopende kurze Bewegungsanimation (optimiertes WebP/WebM statt großer GIFs), Muskelgruppen, Varianten, Technik, letzte Gewichte, Sätze, Wiederholungen.
- Konservative Progression: z. B. erst nach drei vergleichbaren Einheiten mit oberem Wiederholungsziel und sauberer Technik kleinste verfügbare Gewichtsstufe prüfen; Belastung, Schmerzen und Regeneration berücksichtigen. Keine automatische Pflichtsteigerung.
- Smart Comeback: bei längerer Trainingspause freiwillig nach Grund und aktuellem Befinden fragen; Wiedereinstiegsplan vorsichtig anpassen, keine Schuldgefühle.
- Ernährung (manuell, optional Foto/Barcode), Wasser, Schlaf, Gewohnheiten, Fortschritt, privates Fototagebuch, Wochen-/Monatsanalysen.
- KI erklärt und unterstützt; regelbasierte, testbare Trainings-Engine entscheidet über belastungsbezogene Vorschläge. KI-Ausfall blockiert Tracking nicht.

## Technischer Zielzustand
Installierbare Next.js/TypeScript-PWA mit Offline-Trainingsprotokoll und sicherer Synchronisierung; Supabase Auth, Postgres mit RLS (Schema `lifestyle`, Migrationen in `supabase/`), privater Storage, Hintergrundjobs über Supabase Queues/pg_cron; Self-Hosting später über selbst gehostetes Supabase. Stackentscheidung und Regeln: `AGENTS.md`. Anbieterunabhängige KI-Schnittstelle mit Quoten, Kostenlimits und menschlich korrigierbaren Ergebnissen.

## Live testen
Jeder PR bekommt von Vercel eine Preview-URL (Kommentar des Vercel-Bots im PR), `main` geht nach Merge in Produktion. Beide laufen gegen das gemeinsame Supabase-Projekt, Daten liegen im Schema `lifestyle` (RLS).
- Produktion: https://lifestyle-app-silk.vercel.app
- Testzugang: Sinans Testkonto, `TESTNUTZER_EMAIL` / `TESTNUTZER_PASSWORT` in Infisical `/leitstand` (Auth gilt projektweit, das Konto gibt es schon). Das Passwort steht nie in Repo oder PR.
- Ablauf: `/login` öffnen, mit dem Testkonto anmelden → Startseite → „Abmelden“. Nur Test- und Platzhalterdaten eintragen, keine echten Gesundheitsdaten (AGENTS.md Regel 6).
- Neue Migrationen spielt `.github/workflows/migrate.yml` nach Merge ein (Einrichtung: `docs/INFRASTRUCTURE.md`).

## Lokal starten und einloggen
Voraussetzung: Node 22, Docker, Supabase CLI.
1. `npm ci`
2. `supabase start` (Migrationen laufen automatisch). Unter Windows sind die Ports 54278–54377 oft reserviert; dann in `supabase/config.toml` lokal andere Ports setzen (nicht committen).
3. `supabase status -o env` zeigt API-URL und Publishable Key. Beide als `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` setzen (Namen: `.env.example`).
4. `npm run dev`, dann `http://localhost:3000` öffnen (nicht `127.0.0.1`, sonst blockiert der Dev-Server das Laden des JavaScripts).
5. Ohne Sitzung leitet `/` auf `/login` um. Unter `/registrieren` ein Konto anlegen (lokal ohne E-Mail-Bestätigung, Passwort mindestens 6 Zeichen), danach landest du auf der Startseite. „Abmelden“ beendet die Sitzung.
Beim ersten Login legt die App deine eigene Zeile in `lifestyle.profiles` an (RLS erlaubt nur `id = auth.uid()`).

## Roadmap (Schätzung, keine Zusage)
1. W1–2: Architektur, UX, Auth, PWA, Datenschutzkonzept, CI.
2. W3–5: Übungsbibliothek, Training, Cardio, Animationen, Progression, Offline-Sync.
3. W6–8: Ernährung, Schlaf, Gewohnheiten, Ziele, Fortschritt, private Fotos.
4. W9–11: KI-Coach, Geräte-/Essensbilder, Wochenberichte, Smart Comeback.
5. W12–14: E2E, Sicherheit, Export/Löschung, Backup/Restore, Stripe-Testmodus, Self-Hosting.
6. W15–18: geschlossene vierwöchige Beta mit 10 kostenlosen Nutzern, Feedback und Fehlerbehebung.

## Fertig heißt
Funktionierender End-to-End-Nutzerweg, vollständige README mit Installation und Testdaten, reproduzierbares Self-Hosting, dokumentierte Konfiguration/Updates/Backups, grüne unabhängige Tests und tatsächliche Abnahme. Ein Merge oder grüner Build allein reicht nicht.

## Datenschutz / Sicherheit
DSGVO-Prüfung inkl. möglicher Gesundheitsdaten nach Art. 9, Einwilligungen wo erforderlich, Datenminimierung, private Fotos, Zugriffsschutz, Export/Löschung, keine sensiblen Logs, geprüfte Backups. Keine medizinischen Diagnosen, keine unzuverlässigen Körperfett-Messversprechen.

## Monetarisierung
Erste 10 Testpersonen: alle Funktionen kostenlos; Stripe ausschließlich Testmodus. Später vollständige Free-/Self-hosted-Basis und optionale kostenpflichtige Cloud-Komfort-/KI-Funktionen. Preis erst anhand Nutzung und Kosten validieren.

## Leitstand-Handoff
**Freigegeben am 27.10.2026 durch Sinan:** Agenten bauen autonom aus Linear nach `AGENTS.md`. Vor Umsetzung Gedächtnis ↔ Linear ↔ Code/PRs abgleichen, Deltas in kleine unabhängige Issues zerlegen, mit Tests und Abnahmebelegen. Keine bezahlten API-Aufrufe, kein Produktiv-Deployment und keine neuen Secrets ohne Sinan. Sicherheitsgates nicht umgehen.

Siehe Linear-Projekt »Lifestyle App« für Planung und Arbeitspakete.
