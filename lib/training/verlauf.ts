import type { createClient } from "../supabase/client";
import { fuehreAus, type Ergebnis } from "./log";

// Trainingsverlauf (SIN-1279): Workouts und Aktivitäten in einer Liste, einzeln löschbar (docs/PRIVACY.md Abschnitt 6).
// Fehler kommen als Ergebnis zurück, nie als Exception. Keine Logausgabe von Einträgen.
type Client = ReturnType<typeof createClient>;

export type Workout = { id: string; started_at: string; ended_at: string | null };
export type Aktivitaet = { id: string; started_at: string; activity: string; duration_min: number; distance_km: number | null };
export type Eintrag = ({ art: "workout" } & Workout) | ({ art: "aktivitaet" } & Aktivitaet);
export type Monat = { monat: string; eintraege: Eintrag[] };

export const SEITENGROESSE = 20;
const MONAT = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "Europe/Berlin" });

/** Neueste zuerst; bei gleicher Zeit bleibt die Eingabereihenfolge (Workouts vor Aktivitäten). */
export function sortiere(workouts: Workout[], aktivitaeten: Aktivitaet[]): Eintrag[] {
  return [...workouts.map((w) => ({ art: "workout" as const, ...w })), ...aktivitaeten.map((a) => ({ art: "aktivitaet" as const, ...a }))].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
  );
}

/** Gruppiert nach Monat (Europe/Berlin), neuester Monat zuerst. */
export function gruppiere(eintraege: Eintrag[]): Monat[] {
  const monate: Monat[] = [];
  for (const e of eintraege) {
    const monat = MONAT.format(new Date(e.started_at));
    if (monate.at(-1)?.monat === monat) monate.at(-1)!.eintraege.push(e);
    else monate.push({ monat, eintraege: [e] });
  }
  return monate;
}

export const mischeVerlauf = (workouts: Workout[], aktivitaeten: Aktivitaet[]) => gruppiere(sortiere(workouts, aktivitaeten));

/**
 * Eine Seite des Verlaufs. `vor` ist der Cursor: `started_at` des letzten gezeigten Eintrags.
 * Aus beiden Tabellen je eine Seite plus eins laden, mischen, die ersten 20 behalten; so geht kein Eintrag zwischen den Seiten verloren.
 * shortcut: Zwei Einträge mit exakt gleichem `started_at` an der Seitengrenze würden übersprungen (Cursor ist nur die Zeit).
 */
export async function ladeVerlauf(client: Client, { vor }: { vor?: string } = {}): Promise<Ergebnis<{ eintraege: Eintrag[]; weiter: string | null }>> {
  const seite = <T>(tabelle: string, spalten: string) => {
    const abfrage = client.from(tabelle).select(spalten);
    return fuehreAus<T[]>((vor ? abfrage.lt("started_at", vor) : abfrage).order("started_at", { ascending: false }).limit(SEITENGROESSE + 1));
  };
  const [workouts, aktivitaeten] = await Promise.all([
    seite<Workout>("workouts", "id, started_at, ended_at"),
    seite<Aktivitaet>("activity_logs", "id, started_at, activity, duration_min, distance_km"),
  ]);
  if (!workouts.ok) return workouts;
  if (!aktivitaeten.ok) return aktivitaeten;
  const alle = sortiere(workouts.daten ?? [], aktivitaeten.daten ?? []);
  const eintraege = alle.slice(0, SEITENGROESSE);
  return { ok: true, daten: { eintraege, weiter: alle.length > SEITENGROESSE ? eintraege[eintraege.length - 1].started_at : null } };
}

// Sätze hängen per on delete cascade am Workout.
export const loescheWorkout = (client: Client, id: string) => fuehreAus<null>(client.from("workouts").delete().eq("id", id));
export const loescheAktivitaet = (client: Client, id: string) => fuehreAus<null>(client.from("activity_logs").delete().eq("id", id));
export const loescheEintrag = (client: Client, e: Pick<Eintrag, "art" | "id">) =>
  e.art === "workout" ? loescheWorkout(client, e.id) : loescheAktivitaet(client, e.id);
