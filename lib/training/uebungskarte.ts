import type { createClient } from "../supabase/client";
import { empfehle, type Empfehlung } from "./empfehlung";
import { erklaere } from "./erklaerung";
import { alsEinheiten, fuehreAus, type Ergebnis, type Satzzeile } from "./log";
import type { Ziel } from "./progression";

// Daten und Texte der Übungskarte im Training (SIN-1276): was zuletzt war und was die Regel vorschlägt, mit Begründung.
type Client = ReturnType<typeof createClient>;

// Annahme (keine Vorgabe von Sinan, änderbar): ohne Vorgabe aus dem Plan gilt das Wiederholungsziel 8 bis 12.
export const STANDARD_ZIEL: Ziel = { wdhMin: 8, wdhMax: 12 };
const ZULETZT_ANZAHL = 3;
// Genug Sätze für die drei Einheiten, die die Progressionsregel braucht, auch bei vielen Sätzen je Einheit.
const SAETZE_LADEN = 60;
const SPALTEN = "workout_id, set_no, reps, weight_kg, technique, pain, created_at, workouts(regeneration, started_at)";

export type Rueckblick = { workoutId: string; datum: string; gewichtKg: number | null; wiederholungen: number[] };
export type Karte = {
  zuletzt: Rueckblick[]; // neueste zuerst, höchstens drei
  empfehlung: Empfehlung | null; // null = noch keine Einheit
};

/** Frühere Sätze dieser Übung, ohne das laufende Training. */
export function ladeFruehereSaetze(client: Client, exerciseId: string, ohneWorkoutId: string): Promise<Ergebnis<Satzzeile[]>> {
  return fuehreAus<Satzzeile[]>(
    client
      .from("workout_sets")
      .select(SPALTEN)
      .eq("exercise_id", exerciseId)
      .neq("workout_id", ohneWorkoutId)
      .order("created_at", { ascending: false })
      .limit(SAETZE_LADEN),
  );
}

/** Reine Auswertung: Rückblick und Vorschlag aus den früheren Sätzen. */
export function baueKarte(saetze: Satzzeile[], ziel: Ziel, kleinsteStufeKg: number): Karte {
  if (saetze.length === 0) return { zuletzt: [], empfehlung: null };
  const nachWorkout = new Map<string, Satzzeile[]>();
  for (const s of saetze) nachWorkout.set(s.workout_id, [...(nachWorkout.get(s.workout_id) ?? []), s]);
  const start = (gruppe: Satzzeile[]) => gruppe[0].workouts?.started_at ?? gruppe[0].created_at;
  const zuletzt = [...nachWorkout.entries()]
    .sort(([, a], [, b]) => start(b).localeCompare(start(a)))
    .slice(0, ZULETZT_ANZAHL)
    .map(([workoutId, gruppe]) => {
      const sortiert = [...gruppe].sort((a, b) => a.set_no - b.set_no);
      const gewichte = sortiert.map((s) => (s.weight_kg === null ? null : Number(s.weight_kg)));
      return { workoutId, datum: start(gruppe), gewichtKg: gewichte.every((g) => g === null) ? null : Math.max(...gewichte.map((g) => g ?? 0)), wiederholungen: sortiert.map((s) => s.reps) };
    });
  return { zuletzt, empfehlung: empfehle({ einheiten: alsEinheiten(saetze), ziel, kleinsteStufeKg }) };
}

const kg = (wert: number) => `${wert.toLocaleString("de-DE")} kg`;
export const gewichtText = (wert: number | null) => (wert === null || wert === 0 ? "Körpergewicht" : kg(wert));

export const OHNE_VERLAUF = "Noch keine Einheit – starte mit einem Gewicht, das sich gut anfühlt.";

/** Überschrift, Vorschlag als Angebot und Begründung; nie eine Pflicht. */
export function empfehlungText(e: Empfehlung): { titel: string; vorschlag: string; erklaerung: string } {
  const titel = e.aktion === "steigerung_pruefen" ? "Steigerung prüfen" : e.aktion === "sanfter_einstieg" ? "Sanfter Einstieg" : "Gewicht halten";
  const vorschlag =
    e.zielgewichtKg === null
      ? ""
      : e.aktion === "halten"
        ? `Du kannst bei ${gewichtText(e.zielgewichtKg)} bleiben.`
        : `Du kannst ${gewichtText(e.zielgewichtKg)} ausprobieren.`;
  return { titel, vorschlag, erklaerung: erklaere(e.grund) };
}
