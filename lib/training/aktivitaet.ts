import type { createClient } from "../supabase/client";
import { fuehreAus, nutzerId, type Ergebnis } from "./log";

// Aktivitäten ohne Sätze und Gewicht (SIN-1278): Cardio, Mobility, Dehnen, weitere Sportarten → lifestyle.activity_logs.
// Gesundheitsdaten (Einwilligung B): Die Datenbank lehnt Einfügen ohne offene Einwilligung ab. Keine Logausgabe von Einträgen.
type Client = ReturnType<typeof createClient>;

export const AKTIVITAET_KATEGORIEN = { cardio: "Cardio", mobility: "Mobility", dehnen: "Dehnen", sonstiges: "Sonstiges" } as const;
export type Kategorie = keyof typeof AKTIVITAET_KATEGORIEN;
/** Strecke gibt es nur dort, wo sie Sinn ergibt. */
export const mitStrecke = (k: Kategorie) => k === "cardio" || k === "sonstiges";

export type Eingabe = { kategorie: string; aktivitaet: string; dauerMin: string; streckeKm: string; anstrengung: number | null; notiz: string };
export type Aktivitaetswerte = {
  category: Kategorie;
  activity: string;
  duration_min: number;
  distance_km: number | null;
  effort: number | null;
  note: string | null;
};
export type Feld = "kategorie" | "aktivitaet" | "dauer" | "strecke" | "anstrengung" | "notiz";

// Grenzen wie die Checks der Tabelle.
export const FEHLERTEXTE: Record<Feld, string> = {
  kategorie: "Bitte wähl eine Kategorie.",
  aktivitaet: "Bitte gib an, was du gemacht hast (höchstens 60 Zeichen).",
  dauer: "Bitte gib die Dauer als ganze Zahl von 1 bis 1440 Minuten ein.",
  strecke: "Bitte gib die Strecke von 0 bis 1000 km ein oder lass das Feld leer.",
  anstrengung: "Die Anstrengung liegt zwischen 1 und 10.",
  notiz: "Die Notiz darf höchstens 200 Zeichen haben.",
};

const zahl = (text: string) => Number(text.trim().replace(",", "."));

/** Reine Prüfung der Formularwerte; liefert die Spaltenwerte oder die Felder mit Fehler. */
export function pruefeAktivitaet(e: Eingabe): { ok: true; werte: Aktivitaetswerte } | { ok: false; fehler: Feld[] } {
  const fehler: Feld[] = [];
  const kategorie = e.kategorie in AKTIVITAET_KATEGORIEN ? (e.kategorie as Kategorie) : undefined;
  if (!kategorie) fehler.push("kategorie");
  const aktivitaet = e.aktivitaet.trim();
  if (aktivitaet.length < 1 || aktivitaet.length > 60) fehler.push("aktivitaet");
  const dauer = zahl(e.dauerMin);
  if (e.dauerMin.trim() === "" || !Number.isInteger(dauer) || dauer < 1 || dauer > 1440) fehler.push("dauer");
  // Strecke bei Mobility/Dehnen wird verworfen, nicht bemängelt: Das Feld ist dort nicht sichtbar.
  const mitKm = kategorie !== undefined && mitStrecke(kategorie) && e.streckeKm.trim() !== "";
  const strecke = mitKm ? zahl(e.streckeKm) : null;
  if (strecke !== null && (!Number.isFinite(strecke) || strecke < 0 || strecke > 1000)) fehler.push("strecke");
  if (e.anstrengung !== null && (!Number.isInteger(e.anstrengung) || e.anstrengung < 1 || e.anstrengung > 10)) fehler.push("anstrengung");
  const notiz = e.notiz.trim();
  if (notiz.length > 200) fehler.push("notiz");
  if (fehler.length > 0 || !kategorie) return { ok: false, fehler };
  return {
    ok: true,
    werte: { category: kategorie, activity: aktivitaet, duration_min: dauer, distance_km: strecke, effort: e.anstrengung, note: notiz || null },
  };
}

export type Aktivitaetszeile = Aktivitaetswerte & { id: string; started_at: string };
const SPALTEN = "id, started_at, category, activity, duration_min, distance_km, effort, note";

export async function trageAktivitaetEin(client: Client, werte: Aktivitaetswerte): Promise<Ergebnis<Aktivitaetszeile>> {
  const userId = await nutzerId(client);
  if (!userId) return { ok: false, fehler: "no_user" };
  return fuehreAus<Aktivitaetszeile>(client.from("activity_logs").insert({ user_id: userId, ...werte }).select(SPALTEN).single());
}

/** Mit `id` vom Gerät (Offline-Warteschlange, SIN-1287): Eine Wiederholung trifft dieselbe Zeile, statt eine zweite anzulegen. */
export async function speichereAktivitaet(client: Client, id: string, werte: Aktivitaetswerte): Promise<Ergebnis<null>> {
  const userId = await nutzerId(client);
  if (!userId) return { ok: false, fehler: "no_user" };
  return fuehreAus<null>(client.from("activity_logs").upsert({ id, user_id: userId, ...werte }, { onConflict: "id" }));
}

export const loescheAktivitaet = (client: Client, id: string) => fuehreAus<null>(client.from("activity_logs").delete().eq("id", id));

export function letzteAktivitaeten(client: Client, limit: number) {
  return fuehreAus<Aktivitaetszeile[]>(client.from("activity_logs").select(SPALTEN).order("started_at", { ascending: false }).limit(limit));
}
