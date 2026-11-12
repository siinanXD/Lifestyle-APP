import type { createClient } from "../supabase/client";
import { fuehreAus, nutzerId, type Ergebnis } from "../training/log";
import type { Kuechengeraet } from "./geraete";
import { ordneZu } from "./zutaten";

// Küchengeräte und Vorrat (SIN-1625). Kein Art.-9-Inhalt; RLS lässt jede Person nur die eigenen Zeilen sehen.
// Fehler kommen als Ergebnis zurück, nie als Exception.
type Client = ReturnType<typeof createClient>;

export const EINHEITEN = { stueck: "Stück", g: "g", kg: "kg", ml: "ml", l: "l", packung: "Packung", dose: "Dose", glas: "Glas", bund: "Bund" } as const;
export type Einheit = keyof typeof EINHEITEN;
export const ORTE = { kuehlschrank: "Kühlschrank", gefrierfach: "Gefrierfach", vorrat: "Vorratsschrank" } as const;
export type Ort = keyof typeof ORTE;

export type Geraetezeile = { kind: Kuechengeraet; model: string | null };
export type Vorratswerte = { name: string; ingredient_key: string | null; amount: number | null; unit: Einheit | null; location: Ort; best_before: string | null };
export type Vorratszeile = Vorratswerte & { id: string };
export type Eingabe = { name: string; menge: string; einheit: string; ort: string; haltbarBis: string };
export type Feld = "name" | "menge" | "einheit" | "ort" | "haltbarBis";

export const FEHLERTEXTE: Record<Feld, string> = {
  name: "Bitte gib an, was du da hast (höchstens 80 Zeichen).",
  menge: "Bitte gib die Menge als Zahl von 0 bis 100000 ein oder lass das Feld leer.",
  einheit: "Bitte wähl eine Einheit aus der Liste.",
  ort: "Bitte wähl, wo es liegt.",
  haltbarBis: "Bitte gib das Datum im Format Tag.Monat.Jahr ein oder lass das Feld leer.",
};

/** Reine Prüfung der Formularwerte. Der Zutaten-Schlüssel wird aus dem Namen bestimmt; unbekannte Zutaten bleiben ohne Schlüssel. */
export function pruefeVorrat(e: Eingabe): { ok: true; werte: Vorratswerte } | { ok: false; fehler: Feld[] } {
  const fehler: Feld[] = [];
  const name = e.name.trim();
  if (name.length < 1 || name.length > 80) fehler.push("name");
  const mengeText = e.menge.trim().replace(",", ".");
  const menge = mengeText === "" ? null : Number(mengeText);
  if (menge !== null && (!Number.isFinite(menge) || menge < 0 || menge > 100000)) fehler.push("menge");
  const einheit = e.einheit === "" ? null : e.einheit;
  if (einheit !== null && !(einheit in EINHEITEN)) fehler.push("einheit");
  if (!(e.ort in ORTE)) fehler.push("ort");
  const datum = e.haltbarBis.trim();
  if (datum !== "" && (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || Number.isNaN(new Date(`${datum}T00:00:00Z`).getTime()))) fehler.push("haltbarBis");
  if (fehler.length > 0) return { ok: false, fehler };
  return {
    ok: true,
    werte: {
      name,
      ingredient_key: ordneZu(name),
      amount: menge === null ? null : Math.round(menge * 100) / 100,
      unit: einheit as Einheit | null,
      location: e.ort as Ort,
      best_before: datum || null,
    },
  };
}

export const ladeGeraete = (client: Client) => fuehreAus<Geraetezeile[]>(client.from("kitchen_appliances").select("kind, model").order("kind"));

/** Gerät anlegen oder das Modell ändern; je Gerät gibt es höchstens eine Zeile. */
export async function speichereGeraet(client: Client, kind: Kuechengeraet, model: string | null = null): Promise<Ergebnis<null>> {
  const userId = await nutzerId(client);
  if (!userId) return { ok: false, fehler: "no_user" };
  const modell = model?.trim().slice(0, 80) || null;
  return fuehreAus<null>(client.from("kitchen_appliances").upsert({ user_id: userId, kind, model: modell }, { onConflict: "user_id,kind" }));
}

export const entferneGeraet = (client: Client, kind: Kuechengeraet) => fuehreAus<null>(client.from("kitchen_appliances").delete().eq("kind", kind));

const VORRAT_SPALTEN = "id, name, ingredient_key, amount, unit, location, best_before";
export const ladeVorrat = (client: Client) => fuehreAus<Vorratszeile[]>(client.from("pantry_items").select(VORRAT_SPALTEN).order("name"));

/** Anlegen und Ändern in einem (Upsert auf die id vom Gerät). */
export async function speichereVorrat(client: Client, id: string, werte: Vorratswerte): Promise<Ergebnis<null>> {
  const userId = await nutzerId(client);
  if (!userId) return { ok: false, fehler: "no_user" };
  return fuehreAus<null>(client.from("pantry_items").upsert({ id, user_id: userId, ...werte }, { onConflict: "id" }));
}

export const entferneVorrat = (client: Client, id: string) => fuehreAus<null>(client.from("pantry_items").delete().eq("id", id));

export const mengeText = (z: Pick<Vorratswerte, "amount" | "unit">) =>
  z.amount === null ? "" : `${Number(z.amount).toLocaleString("de-DE")}${z.unit ? ` ${EINHEITEN[z.unit]}` : ""}`;
