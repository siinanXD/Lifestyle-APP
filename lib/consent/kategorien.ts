import type { createClient } from "../supabase/client";
import { widerrufeEinwilligung } from "./consent";
import type { Art } from "./texte";

type Client = ReturnType<typeof createClient>;

// Welche Tabelle gehört zu welcher Einwilligung (docs/PRIVACY.md, Abschnitt 2 und 3).
// Jede Tabelle aus supabase/migrations steht hier genau einmal; tests/consent/kategorien.test.ts schlägt bei neuen Tabellen an.
// Reihenfolge = Löschreihenfolge (Sätze vor Trainings, Häkchen vor Gewohnheiten).
// immer: Konto, Einwilligungsnachweis und Trainingspläne, bleiben bis zur Kontolöschung. referenz: ohne Nutzerbezug.
// Pläne enthalten nur Übungen, Sätze und Wiederholungen und brauchen keine Einwilligung (Migration SIN-1282);
// ein Widerruf von B darf sie deshalb nicht mitlöschen.
export const TABELLEN = {
  A: ["habit_checks", "habits"],
  B: [
    "workout_sets",
    "workouts",
    "activity_logs",
    "comeback_checkins",
    "sleep_logs",
    "meals",
    "body_measurements",
    "health_profile",
    "water_logs",
  ],
  C: [],
  D: [],
  E: [],
  immer: ["profiles", "consents", "plan_items", "training_plans"],
  referenz: ["exercises"],
} as const satisfies Record<Art | "immer" | "referenz", readonly string[]>;

// A betrifft außerdem Spalten der Profilzeile: Widerruf mit Löschen setzt sie auf die Defaults zurück.
export const PROFILANGABEN_A = {
  goals: [],
  goal_note: null,
  days_per_week: null,
  minutes_per_session: null,
  experience: null,
  equipment: [],
};

export const hatDaten = (art: Art) => art === "A" || (TABELLEN[art] as readonly string[]).length > 0;

// Läuft im Browser mit der Sitzung der Person; RLS lässt Löschen nur für eigene Zeilen zu (auch ohne B).
// Erst widerrufen, dann löschen: Ab dem Widerruf lehnen Datenbank und Datenschicht neue Einträge der Kategorie ab.
// Sonst könnte ein zweites offenes Fenster nach dem Leeren einer Tabelle noch etwas anlegen, das stehen bleibt.
// Scheitert das Löschen, meldet `widerrufen: true` den Zwischenstand; ein neuer Aufruf löscht den Rest (Löschen geht ohne Einwilligung).
// shortcut: zwei getrennte Anfragen, ein Schreibzugriff genau zwischen Widerruf und Löschen kann in Millisekunden durchrutschen;
// bei Bedarf als Datenbankfunktion mit Sperre auf der Einwilligungszeile neu bauen.
export async function widerrufe(supabase: Client, art: Art, { datenLoeschen }: { datenLoeschen: boolean }) {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) return { error: { code: "no_user" }, widerrufen: false };
  const { error: widerrufFehler } = await widerrufeEinwilligung(supabase, art);
  if (widerrufFehler) return { error: widerrufFehler, widerrufen: false };
  return { error: datenLoeschen ? await loesche(supabase, art, id) : null, widerrufen: true };
}

async function loesche(supabase: Client, art: Art, id: string) {
  if (art === "A") {
    const { error } = await supabase.from("profiles").update(PROFILANGABEN_A).eq("id", id);
    if (error) return error;
  }
  for (const tabelle of TABELLEN[art]) {
    const { error } = await supabase.from(tabelle).delete().eq("user_id", id);
    if (error) return error;
  }
  return null;
}

// Löschen ohne offene Einwilligung: für Daten, die nach einem Widerruf noch da sind (z. B. abgebrochenes Löschen).
export async function loescheDaten(supabase: Client, art: Art) {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) return { error: { code: "no_user" } };
  return { error: await loesche(supabase, art, id) };
}
