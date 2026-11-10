import type { Satzzeile, Workoutzeile } from "../training/log";

// Wochen- und Monatsauswertung als reine Funktion: kein Datenbankzugriff, kein Text, kein Urteil.
// Fehlende Werte sind `null`, nie 0, damit die Seite „nicht erfasst“ von „Null“ unterscheiden kann.
// Tage sind Kalendertage `JJJJ-MM-TT` in der Zeitzone des Aufrufers; `von` und `bis` zählen beide mit.

export type Eingabe = {
  von: string;
  bis: string;
  zeitzone: string;
  /** Aus dem Onboarding; nur Information, kein Soll. */
  tageProWoche: number | null;
  workouts?: Pick<Workoutzeile, "id" | "started_at" | "ended_at">[];
  saetze?: Pick<Satzzeile, "workout_id" | "reps" | "weight_kg">[];
  // Für die folgenden Bereiche gibt es noch keine Tabellen; die Formen sind bewusst klein gehalten.
  aktivitaeten?: { kategorie: string; started_at: string; dauer_min: number | null }[];
  wasser?: { amount_ml: number; logged_at: string }[];
  /** `datum` = Kalendertag des Aufwachens. */
  schlaf?: { datum: string; dauer_min: number }[];
  mahlzeiten?: { eaten_at: string }[];
  /** Ein Eintrag je Häkchen. */
  gewohnheiten?: { datum: string }[];
};

export type Kennzahlen = {
  einheiten: number;
  aktiveMinuten: number | null;
  volumenKg: number | null;
  wasserSchnittMl: number | null;
  schlafSchnittMin: number | null;
  mahlzeitenTage: number | null;
  mahlzeitenProTag: number | null;
  gewohnheitsHaekchen: number | null;
};

export type Auswertung = Kennzahlen & {
  von: string;
  bis: string;
  /** Nur bei genau sieben Tagen gesetzt, sonst `null`. */
  einheitenGeplant: number | null;
  aktivitaetenNachKategorie: Record<string, number> | null;
  /** Tage mit mindestens einem Eintrag in irgendeinem Bereich. */
  erfassteTage: number;
  tage: { datum: string; einheiten: number; wasserMl: number | null }[];
  /** Differenz zur Vorperiode je Kennzahl; `null`, wenn die Vorperiode keinen erfassten Tag hat. */
  veraenderung: { [K in keyof Kennzahlen]: number | null } | null;
};

const TAG_MS = 24 * 60 * 60 * 1000;

const tagPlus = (tag: string, tage: number) => new Date(Date.parse(`${tag}T00:00:00Z`) + tage * TAG_MS).toISOString().slice(0, 10);
const monatsanfang = (tag: string) => `${tag.slice(0, 8)}01`;
const runde = (wert: number, stellen = 0) => Math.round(wert * 10 ** stellen) / 10 ** stellen;
const summe = (werte: number[]) => werte.reduce((a, b) => a + b, 0);
const schnitt = (werte: number[], stellen = 0) => (werte.length ? runde(summe(werte) / werte.length, stellen) : null);

function istTag(tag: string) {
  try {
    return /^\d{4}-\d{2}-\d{2}$/.test(tag) && tagPlus(tag, 0) === tag;
  } catch {
    return false;
  }
}

function lokalerTag(zeitzone: string) {
  // en-CA formatiert als JJJJ-MM-TT.
  const format = new Intl.DateTimeFormat("en-CA", { timeZone: zeitzone, year: "numeric", month: "2-digit", day: "2-digit" });
  return (zeitpunkt: string | Date) => format.format(new Date(zeitpunkt));
}

/** Woche (Montag bis Sonntag) oder Kalendermonat, in dem `heute` in der Zeitzone liegt. */
export function zeitraum(art: "woche" | "monat", heute: Date, zeitzone: string): { von: string; bis: string } {
  const tag = lokalerTag(zeitzone)(heute);
  if (art === "woche") {
    const von = tagPlus(tag, -((new Date(`${tag}T00:00:00Z`).getUTCDay() + 6) % 7));
    return { von, bis: tagPlus(von, 6) };
  }
  const von = monatsanfang(tag);
  return { von, bis: tagPlus(monatsanfang(tagPlus(von, 31)), -1) };
}

// Ein ganzer Kalendermonat wird mit dem Vormonat verglichen, alles andere mit gleich vielen Tagen direkt davor.
function vorperiode(von: string, bis: string, anzahlTage: number) {
  const vorBis = tagPlus(von, -1);
  const ganzerMonat = von === monatsanfang(bis) && tagPlus(bis, 1).endsWith("-01");
  return { von: ganzerMonat ? monatsanfang(vorBis) : tagPlus(von, -anzahlTage), bis: vorBis };
}

function werteAus(e: Eingabe, von: string, bis: string) {
  const tagVon = lokalerTag(e.zeitzone);
  const drin = (tag: string) => tag >= von && tag <= bis;
  const erfasst = new Set<string>();
  const merke = (tag: string) => (drin(tag) ? (erfasst.add(tag), true) : false);

  const workouts = (e.workouts ?? []).filter((w) => merke(tagVon(w.started_at)));
  const workoutIds = new Set(workouts.map((w) => w.id));
  const aktivitaeten = (e.aktivitaeten ?? []).filter((a) => merke(tagVon(a.started_at)));
  const minuten = [
    ...workouts.map((w) => (w.ended_at ? (Date.parse(w.ended_at) - Date.parse(w.started_at)) / 60000 : 0)),
    ...aktivitaeten.map((a) => a.dauer_min ?? 0),
  ];
  // Volumen zählt zum Tag der Einheit; Sätze ohne Gewicht (Körpergewicht) bleiben außen vor.
  const volumen = (e.saetze ?? []).flatMap((s) => (workoutIds.has(s.workout_id) && s.weight_kg !== null ? [s.reps * s.weight_kg] : []));

  const proTag = (tage: string[], werte?: number[]) => {
    const map = new Map<string, number>();
    tage.forEach((tag, i) => {
      if (merke(tag)) map.set(tag, (map.get(tag) ?? 0) + (werte ? werte[i] : 1));
    });
    return map;
  };
  const wasser = proTag((e.wasser ?? []).map((w) => tagVon(w.logged_at)), (e.wasser ?? []).map((w) => w.amount_ml));
  const mahlzeiten = proTag((e.mahlzeiten ?? []).map((m) => tagVon(m.eaten_at)));
  const schlaf = (e.schlaf ?? []).filter((s) => merke(s.datum)).map((s) => s.dauer_min);
  const haekchen = (e.gewohnheiten ?? []).filter((g) => merke(g.datum)).length;

  // Map statt Objekt: Namen wie "constructor" oder "__proto__" träfen sonst geerbte Eigenschaften.
  const zaehler = new Map<string, number>();
  for (const a of aktivitaeten) zaehler.set(a.kategorie, (zaehler.get(a.kategorie) ?? 0) + 1);
  const kategorien: Record<string, number> = Object.fromEntries(zaehler);

  const kennzahlen: Kennzahlen = {
    einheiten: workouts.length,
    aktiveMinuten: minuten.length ? runde(summe(minuten)) : null,
    volumenKg: volumen.length ? runde(summe(volumen), 2) : null,
    wasserSchnittMl: schnitt([...wasser.values()]),
    schlafSchnittMin: schnitt(schlaf),
    mahlzeitenTage: mahlzeiten.size || null,
    mahlzeitenProTag: schnitt([...mahlzeiten.values()], 1),
    gewohnheitsHaekchen: haekchen || null,
  };
  return {
    kennzahlen,
    aktivitaetenNachKategorie: aktivitaeten.length ? kategorien : null,
    erfassteTage: erfasst.size,
    einheitenAm: (tag: string) => workouts.filter((w) => tagVon(w.started_at) === tag).length,
    wasserAm: (tag: string) => wasser.get(tag) ?? null,
  };
}

/**
 * Kennzahlen für `von` bis `bis`. Die Listen dürfen mehr enthalten als den Zeitraum; für den Vergleich
 * müssen sie die Vorperiode mit abdecken. Nicht übergebene Bereiche (z. B. ohne Einwilligung) ergeben `null`.
 */
export function auswertung(eingabe: Eingabe): Auswertung {
  const { von, bis } = eingabe;
  if (!istTag(von) || !istTag(bis) || von > bis) throw new Error("Zeitraum braucht von und bis als JJJJ-MM-TT, von nicht nach bis");

  const anzahlTage = Math.round((Date.parse(bis) - Date.parse(von)) / TAG_MS) + 1;
  const jetzt = werteAus(eingabe, von, bis);
  const vor = vorperiode(von, bis, anzahlTage);
  const davor = werteAus(eingabe, vor.von, vor.bis);

  const schluessel = Object.keys(jetzt.kennzahlen) as (keyof Kennzahlen)[];
  const differenz = (k: keyof Kennzahlen) => {
    const [a, b] = [jetzt.kennzahlen[k], davor.kennzahlen[k]];
    return a === null || b === null ? null : runde(a - b, 2);
  };

  return {
    von,
    bis,
    ...jetzt.kennzahlen,
    einheitenGeplant: anzahlTage === 7 ? eingabe.tageProWoche : null,
    aktivitaetenNachKategorie: jetzt.aktivitaetenNachKategorie,
    erfassteTage: jetzt.erfassteTage,
    tage: Array.from({ length: anzahlTage }, (_, i) => tagPlus(von, i)).map((datum) => ({
      datum,
      einheiten: jetzt.einheitenAm(datum),
      wasserMl: jetzt.wasserAm(datum),
    })),
    veraenderung: davor.erfassteTage
      ? (Object.fromEntries(schluessel.map((k) => [k, differenz(k)])) as Auswertung["veraenderung"])
      : null,
  };
}
