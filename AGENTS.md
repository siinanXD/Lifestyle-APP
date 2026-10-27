# AGENTS.md (Lifestyle App)

Status: Planung, noch kein Code. Quellen: `README.md`, `docs/INFRASTRUCTURE.md`, Linear-Projekt „Lifestyle App“.

## Regeln

1. Bauen erst nach ausdrücklicher Freigabe von Sinan im Linear-Issue (README, „Leitstand-Handoff“). Ohne Freigabe nur lesen, planen und Issues vorschlagen.
2. Ein Linear-Issue, ein Branch `claude/sin-<nr>-…` oder `codex/sin-<nr>-…`, ein PR. Titel als Conventional Commit mit `(SIN-<nr>)`.
3. Erst Test, dann Code. Kleinster Diff; keine neue Abhängigkeit für ein paar Zeilen.
4. Nur Abo-Zugänge (Claude, ChatGPT/Codex, Cursor). Keine Modell-API, keine bezahlten Dienste, kein Deployment und keine neuen Secrets ohne Freigabe.
5. Datenbank: gemeinsames Supabase-Projekt, nur eigenes Schema `lifestyle`. Tabellen anderer Apps nie ändern (`docs/INFRASTRUCTURE.md`).
6. Gesundheitsdaten (DSGVO Art. 9): Datenminimierung, keine sensiblen Logs, keine Personendaten in Prompts, keine medizinischen Diagnosen.
7. Fertig heißt: Der Nutzerweg läuft Ende zu Ende und ist belegt. Merge oder grüner Build allein reicht nicht.
