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
  /**
   * Mit `nurWenn` nur, wenn der gespeicherte Eintrag noch genau diesem entspricht – Vergleich und Löschen in einem Schritt,
   * damit ein Ersatz, der dazwischen eintrifft, nicht verloren geht. Ergebnis: ob entfernt wurde.
   */
  entfernen(id: string, nurWenn?: Eintrag): Promise<boolean>;
  /** Ändert nur Vorhandenes, damit ein Lauf nach `leeren()` (Abmelden) nichts zurückschreibt; `nurWenn` wie bei `entfernen`. Ergebnis: ob geschrieben wurde. */
  aktualisieren(eintrag: Eintrag, nurWenn?: Eintrag): Promise<boolean>;
  leeren(): Promise<void>;
}

/** Passt zu `Ergebnis` aus lib/training/log.ts; eine Exception zählt als Netzfehler. */
export type Senden = (eintrag: Eintrag) => Promise<{ ok: true } | { ok: false; fehler: string }>;
export type Stand = { gesendet: number; offen: number; fehlgeschlagen: number };

export const MAX_VERSUCHE = 10;
// Annahme: Netz weg, Sitzung abgelaufen oder Datenbank kurz nicht erreichbar geht vorbei; jeder andere Fehler (RLS, Validierung, 4xx) ist dauerhaft.
// "db" ist ein Datenbankfehler ohne Code aus lib/training/log.ts: unbekannt, also lieber begrenzt wiederholen als verwerfen.
const VORUEBERGEHEND = ["netz", "no_user", "db"];
// PostgREST PGRST000–003 (Verbindung, Schema-Cache, Pool-Timeout); Postgres-Klassen 08 (Verbindung), 40 (Rollback, Deadlock), 53 (Ressourcen), 57 (Abbruch, Start).
const VORUEBERGEHEND_DB = /^(PGRST00[0-3]|(08|40|53|57)[0-9A-Z]{3})$/;
const istVoruebergehend = (fehler: string) => VORUEBERGEHEND.includes(fehler) || VORUEBERGEHEND_DB.test(fehler);

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
  for (const alt of offen) {
    // Der Stand von jetzt zählt, nicht der vom Beginn des Durchgangs: Nach `leeren()` (Abmelden) geht nichts mehr hinaus,
    // und ein inzwischen ersetzter Eintrag (gleiche id, neuer Inhalt) wird mit dem neuen Inhalt gesendet.
    const eintrag = (await queue.alle()).find((e) => e.id === alt.id);
    if (!eintrag || eintrag.fehlgeschlagen) continue;
    // Wartet der vorderste Eintrag noch, wartet auch der Rest, sonst kippt die Reihenfolge.
    if (eintrag.naechsterVersuchAb && uhr() < Date.parse(eintrag.naechsterVersuchAb)) break;
    // Promise.resolve().then: auch ein Wurf, bevor `senden` ein Promise liefert, landet im Netzfehler-Zweig.
    const fehler = await Promise.resolve()
      .then(() => senden(eintrag))
      .then(
        // Ohne Code meldet das Supabase-SDK einen abgelehnten fetch: das ist ein Netzfehler, kein dauerhafter.
        (r) => (r.ok ? null : r.fehler || "netz"),
        () => "netz",
      );
    // Ergebnis und Zähler gelten nur für die gesendete Fassung: Der Speicher schreibt oder löscht nur, wenn sie noch unverändert dasteht.
    const versuche = eintrag.versuche + 1;
    const dauerhaft = fehler !== null && (!istVoruebergehend(fehler) || versuche >= MAX_VERSUCHE);
    const erledigt =
      fehler === null
        ? await queue.entfernen(eintrag.id, eintrag)
        : await queue.aktualisieren(
            dauerhaft
              ? { ...eintrag, versuche, fehlgeschlagen: fehler }
              : { ...eintrag, versuche, naechsterVersuchAb: new Date(uhr() + wartezeitMs(versuche)).toISOString() },
            eintrag,
          );
    if (fehler === null) gesendet++;
    if (!erledigt) {
      // Ersetzt, während er unterwegs war: Die neue Fassung muss vor allem Späteren hinaus, also endet der Durchgang hier.
      // Ganz verschwunden (Abmelden): weiter, die übrigen fallen beim nächsten Lesen ebenfalls weg.
      if ((await queue.alle()).some((e) => e.id === eintrag.id)) break;
      continue;
    }
    if (fehler !== null && !dauerhaft) break; // Netz weg: der Rest bleibt unangetastet
  }
  const rest = await queue.alle();
  const fehlgeschlagen = rest.filter((e) => e.fehlgeschlagen).length;
  return { gesendet, offen: rest.length - fehlgeschlagen, fehlgeschlagen };
}
