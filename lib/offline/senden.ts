import type { createClient } from "../supabase/client";
import { trageWasserEin } from "../essen/wasser";
import { speichereAktivitaet, type Aktivitaetswerte } from "../training/aktivitaet";
import { beendeWorkout, fuehreAus, loescheSatz, nutzerId, speichereSatz, type Ergebnis, type Satz } from "../training/log";
import type { Eintrag, Senden } from "./queue";

// Übersetzt Einträge der Warteschlange in Schreibzugriffe (SIN-1287). Jeder Zugriff ist idempotent: Nach einem Absturz zwischen
// Senden und Entfernen geht derselbe Eintrag noch einmal hinaus und darf keine zweite Zeile erzeugen.
// Konfliktregel (Annahme): Das Gerät gewinnt. Der zuletzt geschriebene Satz mit gleichem Schlüssel (Training, Übung, Satznummer)
// überschreibt; im Beta-Umfang bearbeitet niemand sonst dieselben Daten.
type Client = ReturnType<typeof createClient>;

export type WorkoutStart = { id: string; planId?: string; tagNr?: number };
export type WorkoutEnde = { id: string; regeneration?: "gut" | "schlecht" };
export type SatzLoeschen = Pick<Satz, "workoutId" | "exerciseId" | "satzNr">;
export type AktivitaetEintrag = Aktivitaetswerte & { id: string };

// 23503: Das Training gibt es nicht mehr (vor dem Senden gelöscht). Der Eintrag ist damit gegenstandslos und wird verworfen.
// 23505: Die Zeile mit dieser id ist schon da (Wiederholung nach Absturz). Das Ziel ist erreicht.
const ERLEDIGT = ["23503", "23505"];
const alsStand = (r: Ergebnis<unknown>) => (r.ok || ERLEDIGT.includes(r.fehler) ? ({ ok: true } as const) : r);

export function sender(client: Client): Senden {
  return async (eintrag: Eintrag) => {
    switch (eintrag.art) {
      case "workout_start": {
        const { id, planId, tagNr } = eintrag.daten as WorkoutStart;
        const userId = await nutzerId(client);
        if (!userId) return { ok: false, fehler: "no_user" };
        const zeile = { id, user_id: userId, ...(planId && { plan_id: planId, plan_day_no: tagNr }) };
        return alsStand(await fuehreAus(client.from("workouts").upsert(zeile, { onConflict: "id", ignoreDuplicates: true })));
      }
      case "satz":
        return alsStand(await speichereSatz(client, eintrag.daten as Satz));
      case "satz_loeschen":
        // Löschen eines nicht vorhandenen Satzes ist kein Fehler: delete trifft dann null Zeilen.
        return alsStand(await loescheSatz(client, eintrag.daten as SatzLoeschen));
      case "workout_ende": {
        const { id, regeneration } = eintrag.daten as WorkoutEnde;
        return alsStand(await beendeWorkout(client, id, regeneration ? { regeneration } : {}));
      }
      case "aktivitaet": {
        const { id, ...werte } = eintrag.daten as AktivitaetEintrag;
        return alsStand(await speichereAktivitaet(client, id, werte));
      }
      case "wasser": {
        const { id, ml } = eintrag.daten as { id: string; ml: number };
        return alsStand(await trageWasserEin(client, ml, { id }));
      }
    }
  };
}
