import type { createClient } from "../supabase/client";
import { fuehreAus, nutzerId, type Ergebnis } from "../training/log";

// Mahlzeiten (SIN-1293): manuell eintragen, ändern, löschen; alle Nährwerte sind freiwillig.
// Gesundheitsdaten (Einwilligung B): Die Datenbank lehnt Schreiben ohne offene Einwilligung ab. Keine Logausgabe von Einträgen.
// Keine Zielvorgabe und keine Wertung: Die App zählt nur zusammen, was angegeben wurde.
type Client = ReturnType<typeof createClient>;

export type Mahlzeitwerte = {
  eaten_at: string;
  name: string;
  amount_note: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};
export type Mahlzeit = Mahlzeitwerte & { id: string };
export type Eingabe = { name: string; menge: string; kcal: string; eiweiss: string; kohlenhydrate: string; fett: string; zeit: Date };
export type Feld = "name" | "menge" | "kcal" | "eiweiss" | "kohlenhydrate" | "fett";

export const HINWEIS = "Nährwerte sind Angaben von dir oder Schätzungen und kein Ersatz für ärztliche oder ernährungsberatende Beratung.";
// Grenzen wie die Checks der Tabelle lifestyle.meals.
export const FEHLERTEXTE: Record<Feld, string> = {
  name: "Bitte gib an, was du gegessen hast (höchstens 100 Zeichen).",
  menge: "Die Menge darf höchstens 60 Zeichen haben.",
  kcal: "Bitte gib die Kalorien als ganze Zahl von 0 bis 5000 ein oder lass das Feld leer.",
  eiweiss: "Bitte gib das Eiweiß von 0 bis 1000 g ein oder lass das Feld leer.",
  kohlenhydrate: "Bitte gib die Kohlenhydrate von 0 bis 1000 g ein oder lass das Feld leer.",
  fett: "Bitte gib das Fett von 0 bis 1000 g ein oder lass das Feld leer.",
};

const zahl = (text: string) => (text.trim() === "" ? null : Number(text.trim().replace(",", ".")));
const gramm = (wert: number | null) => wert === null || (Number.isFinite(wert) && wert >= 0 && wert <= 1000);

/** Reine Prüfung der Formularwerte; liefert die Spaltenwerte oder die Felder mit Fehler. Gramm werden auf eine Nachkommastelle gerundet. */
export function pruefeMahlzeit(e: Eingabe): { ok: true; werte: Mahlzeitwerte } | { ok: false; fehler: Feld[] } {
  const fehler: Feld[] = [];
  const name = e.name.trim();
  if (name.length < 1 || name.length > 100) fehler.push("name");
  const menge = e.menge.trim();
  if (menge.length > 60) fehler.push("menge");
  const kcal = zahl(e.kcal);
  if (kcal !== null && (!Number.isInteger(kcal) || kcal < 0 || kcal > 5000)) fehler.push("kcal");
  const [eiweiss, kohlenhydrate, fett] = [zahl(e.eiweiss), zahl(e.kohlenhydrate), zahl(e.fett)];
  if (!gramm(eiweiss)) fehler.push("eiweiss");
  if (!gramm(kohlenhydrate)) fehler.push("kohlenhydrate");
  if (!gramm(fett)) fehler.push("fett");
  if (fehler.length > 0) return { ok: false, fehler };
  const runde = (g: number | null) => (g === null ? null : Math.round(g * 10) / 10);
  return {
    ok: true,
    werte: { eaten_at: e.zeit.toISOString(), name, amount_note: menge || null, kcal, protein_g: runde(eiweiss), carbs_g: runde(kohlenhydrate), fat_g: runde(fett) },
  };
}

// Tagesgrenze 00:00 in der Zeitzone des Geräts (wie beim Wasser).
const tagesbeginn = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
export const gleicherTag = (a: Date, b: Date) => tagesbeginn(a) === tagesbeginn(b);
/** Mahlzeiten eines Tages, früheste zuerst. */
export const amTag = <T extends Pick<Mahlzeit, "eaten_at">>(liste: T[], tag: Date) =>
  liste.filter((m) => gleicherTag(new Date(m.eaten_at), tag)).sort((a, b) => a.eaten_at.localeCompare(b.eaten_at));

export type Summe = { kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null };
/** Zählt je Nährwert nur vorhandene Angaben; ohne jede Angabe bleibt der Wert null (nicht 0). */
export function summe(liste: Pick<Mahlzeit, keyof Summe>[]): Summe {
  const feld = (f: keyof Summe) => {
    const werte = liste.map((m) => m[f]).filter((w): w is number => w !== null && w !== undefined);
    return werte.length === 0 ? null : Math.round(werte.reduce((s, w) => s + Number(w), 0) * 10) / 10;
  };
  return { kcal: feld("kcal"), protein_g: feld("protein_g"), carbs_g: feld("carbs_g"), fat_g: feld("fat_g") };
}

export const SCHNELLWAHL_ANZAHL = 10;
/** Die zuletzt gegessenen, verschiedenen Mahlzeiten (nach Name, Groß-/Kleinschreibung egal), neueste zuerst. */
export function zuletztGegessen<T extends Pick<Mahlzeit, "name" | "eaten_at">>(liste: T[], anzahl = SCHNELLWAHL_ANZAHL): T[] {
  const gesehen = new Set<string>();
  return [...liste]
    .sort((a, b) => b.eaten_at.localeCompare(a.eaten_at))
    .filter((m) => {
      const schluessel = m.name.trim().toLocaleLowerCase("de-DE");
      return !gesehen.has(schluessel) && gesehen.add(schluessel);
    })
    .slice(0, anzahl);
}

export const TAGE_LADEN = 30;
export const ladebeginn = (jetzt = new Date()) => new Date(jetzt.getTime() - (TAGE_LADEN + 1) * 24 * 60 * 60 * 1000).toISOString();
const SPALTEN = "id, eaten_at, name, amount_note, kcal, protein_g, carbs_g, fat_g";

export function ladeMahlzeiten(client: Client, seitIso: string) {
  return fuehreAus<Mahlzeit[]>(client.from("meals").select(SPALTEN).gte("eaten_at", seitIso).order("eaten_at", { ascending: false }));
}

/** Anlegen und Ändern in einem: Die id kommt vom Gerät (Offline-Warteschlange), eine Wiederholung trifft dieselbe Zeile. */
export async function schreibeMahlzeit(client: Client, id: string, werte: Mahlzeitwerte): Promise<Ergebnis<null>> {
  const userId = await nutzerId(client);
  if (!userId) return { ok: false, fehler: "no_user" };
  return fuehreAus<null>(client.from("meals").upsert({ id, user_id: userId, ...werte }, { onConflict: "id" }));
}

export const entferneMahlzeit = (client: Client, id: string) => fuehreAus<null>(client.from("meals").delete().eq("id", id));
