// Warteschlange für Trainingsdaten, die offline erfasst wurden (SIN-1286).
// Reine Logik: Der Speicher wird injiziert (IndexedDB im Browser, In-Memory im Test), gesendet wird über eine übergebene Funktion.
// Die Queue enthält nur Trainingsdaten der angemeldeten Person; `leeren()` löscht alles. Keine Logausgabe der Einträge.

export type Art = "workout_start" | "satz" | "satz_loeschen" | "workout_ende" | "aktivitaet";

export type Eintrag = {
  id: string; // UUID vom Client; der Server schreibt idempotent auf diesen Schlüssel
  art: Art;
  daten: unknown;
  erstelltAm: string; // ISO-Zeit, bestimmt die Sendereihenfolge
  versuche: number;
  naechsterVersuchAb?: string; // ISO-Zeit; vorher wird nicht erneut gesendet
  fehlgeschlagen?: string; // Fehlercode; gesetzt = wird nicht mehr gesendet, bleibt aber gespeichert
};

export interface Speicher {
  alle(): Promise<Eintrag[]>;
  /** Gleiche `id` überschreibt, statt zu verdoppeln. */
  hinzufuegen(eintrag: Eintrag): Promise<void>;
  entfernen(id: string): Promise<void>;
  /** Ändert nur Vorhandenes, damit ein Lauf nach `leeren()` (Abmelden) nichts zurückschreibt. */
  aktualisieren(eintrag: Eintrag): Promise<void>;
  leeren(): Promise<void>;
}

/** Passt zu `Ergebnis` aus lib/training/log.ts; eine Exception zählt als Netzfehler. */
export type Senden = (eintrag: Eintrag) => Promise<{ ok: true } | { ok: false; fehler: string }>;
export type Stand = { gesendet: number; offen: number; fehlgeschlagen: number };

export const MAX_VERSUCHE = 10;
// Annahme: Netz weg oder Sitzung abgelaufen geht vorbei; jeder andere Fehler (RLS, Validierung, 4xx) ist dauerhaft.
const VORUEBERGEHEND = ["netz", "no_user"];

/** Abstand vor dem nächsten Versuch: 30 s, 1 min, 2 min, … */
export const wartezeitMs = (versuche: number) => 30_000 * 2 ** (versuche - 1);

let letzteZeit = 0;
export function neuerEintrag(art: Art, daten: unknown): Eintrag {
  // Streng steigend, damit z. B. Workout-Start und erster Satz in derselben Millisekunde ihre Reihenfolge behalten.
  letzteZeit = Math.max(Date.now(), letzteZeit + 1);
  return { id: crypto.randomUUID(), art, daten, erstelltAm: new Date(letzteZeit).toISOString(), versuche: 0 };
}

/**
 * Sendet offene Einträge in der Reihenfolge von `erstelltAm`.
 * Erst senden, dann entfernen: Nach einem Absturz dazwischen wird derselbe Eintrag (gleiche `id`) noch einmal gesendet.
 * Nicht parallel aufrufen; der Aufrufer wartet den laufenden Durchgang ab.
 * `uhr` wird je Eintrag neu gelesen: Eine Anfrage kann länger hängen als die Wartezeit.
 */
export async function verarbeite(queue: Speicher, senden: Senden, uhr: () => number = Date.now): Promise<Stand> {
  const offen = (await queue.alle()).filter((e) => !e.fehlgeschlagen).sort((a, b) => a.erstelltAm.localeCompare(b.erstelltAm));
  let gesendet = 0;
  for (const eintrag of offen) {
    // Wartet der vorderste Eintrag noch, wartet auch der Rest, sonst kippt die Reihenfolge.
    if (eintrag.naechsterVersuchAb && uhr() < Date.parse(eintrag.naechsterVersuchAb)) break;
    // Nach `leeren()` (Abmelden) mitten im Durchgang darf nichts mehr hinausgehen: nur senden, was noch in der Queue steht.
    if (!(await queue.alle()).some((e) => e.id === eintrag.id)) continue;
    const fehler = await senden(eintrag).then(
      // Ohne Code meldet das Supabase-SDK einen abgelehnten fetch: das ist ein Netzfehler, kein dauerhafter.
      (r) => (r.ok ? null : r.fehler || "netz"),
      () => "netz",
    );
    if (fehler === null) {
      await queue.entfernen(eintrag.id);
      gesendet++;
      continue;
    }
    const versuche = eintrag.versuche + 1;
    if (!VORUEBERGEHEND.includes(fehler)) {
      await queue.aktualisieren({ ...eintrag, versuche, fehlgeschlagen: fehler });
      continue;
    }
    await queue.aktualisieren(
      versuche >= MAX_VERSUCHE
        ? { ...eintrag, versuche, fehlgeschlagen: fehler }
        : { ...eintrag, versuche, naechsterVersuchAb: new Date(uhr() + wartezeitMs(versuche)).toISOString() },
    );
    break; // Netz weg: der Rest bleibt unangetastet
  }
  const rest = await queue.alle();
  const fehlgeschlagen = rest.filter((e) => e.fehlgeschlagen).length;
  return { gesendet, offen: rest.length - fehlgeschlagen, fehlgeschlagen };
}
