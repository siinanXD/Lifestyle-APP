import type { createClient } from "../supabase/client";
import { fuehreAus, nutzerId, type Ergebnis } from "../training/log";
import { pruefeVorrat, type Einheit, type Feld } from "./kueche";
import type { Rezept } from "./rezepte";
import { zutatName } from "./zutaten";

// Einkaufsliste (SIN-1627). Kein Art.-9-Inhalt; RLS lässt jede Person nur die eigenen Zeilen sehen.
// Fehler kommen als Ergebnis zurück, nie als Exception.
type Client = ReturnType<typeof createClient>;

export type Einkaufswerte = { name: string; ingredient_key: string | null; amount: number | null; unit: Einheit | null };
export type Einkaufszeile = Einkaufswerte & { id: string; done: boolean; recipe_slug: string | null };

const gruppe = (e: Einkaufswerte) => `${e.ingredient_key ?? `name:${e.name.trim().toLowerCase()}`}|${e.unit ?? ""}|${e.amount === null ? "ohne" : "menge"}`;

/**
 * Fasst gleiche Einträge zusammen: gleiche Zutat und gleiche Einheit werden addiert, eine andere Einheit bleibt getrennt,
 * Einträge ohne Menge bleiben ohne Menge (und getrennt von Einträgen mit Menge). Der erste Eintrag einer Gruppe behält seine übrigen Felder.
 */
export function fasseZusammen<T extends Einkaufswerte>(eintraege: T[]): T[] {
  const gruppen = new Map<string, T>();
  for (const e of eintraege) {
    const alt = gruppen.get(gruppe(e));
    if (!alt) gruppen.set(gruppe(e), { ...e });
    else if (alt.amount !== null && e.amount !== null) alt.amount = Math.round((alt.amount + e.amount) * 100) / 100;
  }
  return [...gruppen.values()];
}

const SPALTEN = "id, name, ingredient_key, amount, unit, done, recipe_slug";
export const ladeEinkauf = (client: Client) => fuehreAus<Einkaufszeile[]>(client.from("shopping_items").select(SPALTEN).order("name"));

/** Reine Prüfung des Formulars für einen eigenen Eintrag; gleiche Regeln wie beim Vorrat. */
export function pruefeEinkauf(e: { name: string; menge: string; einheit: string }): { ok: true; werte: Einkaufswerte } | { ok: false; fehler: Feld[] } {
  const r = pruefeVorrat({ ...e, ort: "vorrat", haltbarBis: "" });
  if (!r.ok) return r;
  const { name, ingredient_key, amount, unit } = r.werte;
  return { ok: true, werte: { name, ingredient_key, amount, unit } };
}

/**
 * Legt Einträge an und fasst sie mit den offenen Einträgen der Liste zusammen. Abgehakte Einträge bleiben unberührt.
 * Liefert die Zahl der übergebenen Einträge.
 */
export async function setzeAufListe(client: Client, neue: (Einkaufswerte & { recipe_slug?: string | null })[]): Promise<Ergebnis<number>> {
  const userId = await nutzerId(client);
  if (!userId) return { ok: false, fehler: "no_user" };
  if (neue.length === 0) return { ok: true, daten: 0 };
  const offen = await fuehreAus<Einkaufszeile[]>(client.from("shopping_items").select(SPALTEN).eq("done", false));
  if (!offen.ok) return offen;
  const alle = fasseZusammen([...(offen.daten ?? []), ...neue.map((n) => ({ ...n, id: crypto.randomUUID(), done: false, recipe_slug: n.recipe_slug ?? null }))]);
  const r = await fuehreAus<null>(client.from("shopping_items").upsert(alle.map((z) => ({ ...z, user_id: userId })), { onConflict: "id" }));
  return r.ok ? { ok: true, daten: neue.length } : r;
}

/** Fehlende Zutaten eines Rezepts auf die Liste setzen, mit Menge und Einheit aus dem Rezept. */
export function uebernehmeAusRezept(client: Client, rezept: Rezept, fehlend: string[]): Promise<Ergebnis<number>> {
  return setzeAufListe(
    client,
    rezept.zutaten
      .filter((z) => fehlend.includes(z.key))
      .map((z) => ({ name: zutatName(z.key), ingredient_key: z.key, amount: z.menge ?? null, unit: z.einheit ?? null, recipe_slug: rezept.slug })),
  );
}

export const hakeAb = (client: Client, id: string, done: boolean) => fuehreAus<null>(client.from("shopping_items").update({ done }).eq("id", id));
export const entferneEinkauf = (client: Client, id: string) => fuehreAus<null>(client.from("shopping_items").delete().eq("id", id));

/**
 * Abgehakte Einträge in den Vorrat legen und von der Liste nehmen. Erst anlegen, dann löschen:
 * Scheitert das Löschen, steht lieber etwas doppelt im Vorrat, als dass ein Einkauf verschwindet.
 */
export async function legeInVorrat(client: Client): Promise<Ergebnis<number>> {
  const userId = await nutzerId(client);
  if (!userId) return { ok: false, fehler: "no_user" };
  const erledigt = await fuehreAus<Einkaufszeile[]>(client.from("shopping_items").select(SPALTEN).eq("done", true));
  if (!erledigt.ok) return erledigt;
  const zeilen = erledigt.daten ?? [];
  if (zeilen.length === 0) return { ok: true, daten: 0 };
  const rein = await fuehreAus<null>(
    client.from("pantry_items").insert(zeilen.map((z) => ({ user_id: userId, name: z.name, ingredient_key: z.ingredient_key, amount: z.amount, unit: z.unit, location: "kuehlschrank", source: "einkauf" }))),
  );
  if (!rein.ok) return rein;
  const raus = await fuehreAus<null>(client.from("shopping_items").delete().in("id", zeilen.map((z) => z.id)));
  return raus.ok ? { ok: true, daten: zeilen.length } : raus;
}
