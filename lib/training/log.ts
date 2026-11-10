import type { createClient } from "../supabase/client";
import type { Einheit } from "./progression";

// Eine Schicht für Protokoll-UI, Progression, Comeback und später Offline-Sync (SIN-1273).
// Fehler kommen als Ergebnis zurück, nie als Exception, damit UI und Warteschlange reagieren können. Keine Logausgabe von Satzdaten.
type Client = ReturnType<typeof createClient>;
export type Ergebnis<T> = { ok: true; daten: T } | { ok: false; fehler: string };

export type Satz = {
  workoutId: string;
  exerciseId: string;
  satzNr: number;
  wdh: number;
  gewichtKg: number | null; // null = Körpergewicht
  technik: "sauber" | "wackelig";
  schmerz: boolean;
};

export type Satzzeile = {
  workout_id: string;
  set_no: number;
  reps: number;
  weight_kg: number | null;
  technique: "sauber" | "wackelig";
  pain: boolean;
  created_at: string;
  workouts: { regeneration: "gut" | "schlecht" | null; started_at: string } | null;
};

export type Workoutzeile = { id: string; started_at: string; ended_at: string | null; regeneration: "gut" | "schlecht" | null };

const TAG_MS = 24 * 60 * 60 * 1000;
const SATZ_SPALTEN = "workout_id, set_no, reps, weight_kg, technique, pain, created_at, workouts(regeneration, started_at)";

export async function fuehreAus<T>(anfrage: PromiseLike<{ data: unknown; error: { code?: string } | null }>): Promise<Ergebnis<T>> {
  try {
    const { data, error } = await anfrage;
    return error ? { ok: false, fehler: error.code ?? "db" } : { ok: true, daten: data as T };
  } catch {
    return { ok: false, fehler: "netz" };
  }
}

export async function nutzerId(client: Client) {
  try {
    return (await client.auth.getUser()).data.user?.id;
  } catch {
    return undefined;
  }
}

export async function starteWorkout(client: Client, { id, planDayId }: { id?: string; planDayId?: string } = {}) {
  const userId = await nutzerId(client);
  if (!userId) return { ok: false, fehler: "no_user" } as const;
  return fuehreAus<{ id: string }>(
    client
      .from("workouts")
      .insert({ ...(id && { id }), user_id: userId, plan_day_id: planDayId ?? null })
      .select("id")
      .single(),
  );
}

export function beendeWorkout(
  client: Client,
  id: string,
  { regeneration, note }: { regeneration?: "gut" | "schlecht"; note?: string },
) {
  const werte = { ended_at: new Date().toISOString(), ...(regeneration && { regeneration }), ...(note && { note }) };
  return fuehreAus<null>(client.from("workouts").update(werte).eq("id", id));
}

export async function speichereSatz(client: Client, satz: Satz, { nurNeu = false }: { nurNeu?: boolean } = {}): Promise<Ergebnis<null>> {
  if (!(satz.wdh >= 0) || (satz.gewichtKg !== null && !(satz.gewichtKg >= 0)) || !(satz.satzNr >= 1)) {
    return { ok: false, fehler: "ungueltig" };
  }
  const userId = await nutzerId(client);
  if (!userId) return { ok: false, fehler: "no_user" };
  const zeile = {
    workout_id: satz.workoutId,
    user_id: userId,
    exercise_id: satz.exerciseId,
    set_no: satz.satzNr,
    reps: satz.wdh,
    weight_kg: satz.gewichtKg,
    technique: satz.technik,
    pain: satz.schmerz,
  };
  // nurNeu: ein neuer Satz darf keinen vorhandenen überschreiben (z. B. aus einem zweiten Fenster); Konflikt → fehler "23505".
  if (nurNeu) return fuehreAus(client.from("workout_sets").insert(zeile));
  // Gleicher Schlüssel überschreibt: zweimal derselbe Satz bleibt ein Satz (Doppelklick, spätere Offline-Wiederholung).
  return fuehreAus(client.from("workout_sets").upsert(zeile, { onConflict: "workout_id,set_no,exercise_id" }));
}

export function loescheSatz(client: Client, { workoutId, exerciseId, satzNr }: Pick<Satz, "workoutId" | "exerciseId" | "satzNr">) {
  return fuehreAus<null>(client.from("workout_sets").delete().match({ workout_id: workoutId, exercise_id: exerciseId, set_no: satzNr }));
}

export function letzteSaetze(client: Client, exerciseId: string, limit: number) {
  return fuehreAus<Satzzeile[]>(
    client.from("workout_sets").select(SATZ_SPALTEN).eq("exercise_id", exerciseId).order("created_at", { ascending: false }).limit(limit),
  );
}

export function saetzeDesWorkouts(client: Client, workoutId: string) {
  return fuehreAus<(Satzzeile & { exercise_id: string; exercises: { name: string } | null })[]>(
    client
      .from("workout_sets")
      .select(`exercise_id, exercises(name), ${SATZ_SPALTEN}`)
      .eq("workout_id", workoutId)
      .order("created_at", { ascending: true }),
  );
}

export function letzteWorkouts(client: Client, limit: number) {
  return fuehreAus<Workoutzeile[]>(
    client.from("workouts").select("id, started_at, ended_at, regeneration").order("started_at", { ascending: false }).limit(limit),
  );
}

/** Ganze Tage seit dem letzten beendeten Workout; noch nie trainiert → null. */
export async function tageSeitLetzterEinheit(client: Client, jetzt = new Date()): Promise<Ergebnis<number | null>> {
  const r = await fuehreAus<{ ended_at: string }[]>(
    client.from("workouts").select("ended_at").not("ended_at", "is", null).order("ended_at", { ascending: false }).limit(1),
  );
  if (!r.ok) return r;
  const letzte = r.daten[0]?.ended_at;
  return { ok: true, daten: letzte ? Math.floor((jetzt.getTime() - new Date(letzte).getTime()) / TAG_MS) : null };
}

function haeufigstes(werte: number[]) {
  const anzahl = new Map<number, number>();
  for (const w of werte) anzahl.set(w, (anzahl.get(w) ?? 0) + 1);
  // Bei Gleichstand gewinnt das zuerst gelaufene Gewicht.
  return [...anzahl.entries()].reduce((best, e) => (e[1] > best[1] ? e : best))[0];
}

/** Sätze einer Übung → Einheiten für die Progressionsregel, älteste zuerst. */
export function alsEinheiten(saetze: Satzzeile[]): Einheit[] {
  const nachWorkout = new Map<string, Satzzeile[]>();
  for (const s of saetze) nachWorkout.set(s.workout_id, [...(nachWorkout.get(s.workout_id) ?? []), s]);
  const start = (gruppe: Satzzeile[]) => gruppe[0].workouts?.started_at ?? gruppe[0].created_at;
  return [...nachWorkout.values()]
    .sort((a, b) => start(a).localeCompare(start(b)))
    .map((gruppe) => {
      const sortiert = [...gruppe].sort((a, b) => a.set_no - b.set_no);
      return {
        gewichtKg: haeufigstes(sortiert.map((s) => Number(s.weight_kg ?? 0))),
        wiederholungenProSatz: sortiert.map((s) => s.reps),
        technik: sortiert.some((s) => s.technique === "wackelig") ? "wackelig" : "sauber",
        schmerz: sortiert.some((s) => s.pain),
        regeneration: sortiert[0].workouts?.regeneration ?? "unbekannt",
      };
    });
}
