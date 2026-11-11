import type { createClient } from "../supabase/client";
import { fuehreAus, nutzerId, type Ergebnis } from "./log";

// Gespeicherten Plan ansehen, ändern und ein Training daraus starten (SIN-1285). Fehler kommen als Ergebnis zurück, nie als Exception.
type Client = ReturnType<typeof createClient>;

export type Planposition = { id: string; exercise_id: string; name: string; slug: string | null; sets: number; rep_min: number; rep_max: number };
export type Plantag = { tagNr: number; positionen: Planposition[] };
export type AktiverPlan = { id: string; name: string; source: "regeln" | "manuell"; general: boolean; tage: Plantag[] };

type Itemzeile = Omit<Planposition, "name" | "slug"> & { day_no: number; position: number; exercises: { name: string; slug: string } | null };
const ITEM_SPALTEN = "id, day_no, position, exercise_id, sets, rep_min, rep_max, exercises(name, slug)";

/**
 * Welcher Plantag ist dran? Kein Wochentagszwang und kein „verpasst“: Es zählt nur die Reihenfolge.
 * `tage` sind die Tagnummern des Plans, `zuletzt` die Tagnummer des letzten Trainings aus diesem Plan (ohne Verlauf: undefined).
 * Nach dem letzten Tag kommt wieder der erste. Gibt es den zuletzt trainierten Tag nicht mehr, geht es beim nächsthöheren weiter.
 */
export function naechsterTag(tage: number[], zuletzt?: number | null): number | undefined {
  const sortiert = [...new Set(tage)].sort((a, b) => a - b);
  if (zuletzt == null) return sortiert[0];
  return sortiert.find((t) => t > zuletzt) ?? sortiert[0];
}

function alsTage(zeilen: Itemzeile[]): Plantag[] {
  const tage = new Map<number, Planposition[]>();
  for (const z of [...zeilen].sort((a, b) => a.day_no - b.day_no || a.position - b.position)) {
    const { id, exercise_id, sets, rep_min, rep_max } = z;
    const position = { id, exercise_id, sets, rep_min, rep_max, name: z.exercises?.name ?? "Übung", slug: z.exercises?.slug ?? null };
    tage.set(z.day_no, [...(tage.get(z.day_no) ?? []), position]);
  }
  return [...tage.entries()].map(([tagNr, positionen]) => ({ tagNr, positionen }));
}

/** Der aktive Plan mit seinen Tagen; ohne Plan → null. */
export async function ladeAktivenPlan(client: Client): Promise<Ergebnis<AktiverPlan | null>> {
  const plan = await fuehreAus<Omit<AktiverPlan, "tage"> | null>(
    client.from("training_plans").select("id, name, source, general").eq("active", true).maybeSingle(),
  );
  if (!plan.ok || !plan.daten) return plan as Ergebnis<null>;
  const items = await fuehreAus<Itemzeile[]>(client.from("plan_items").select(ITEM_SPALTEN).eq("plan_id", plan.daten.id));
  if (!items.ok) return items;
  return { ok: true, daten: { ...plan.daten, tage: alsTage(items.daten ?? []) } };
}

/** Positionen eines Plantags, z. B. als Vorgabe im Protokoll. */
export async function ladePlantag(client: Client, planId: string, tagNr: number): Promise<Ergebnis<Planposition[]>> {
  const items = await fuehreAus<Itemzeile[]>(client.from("plan_items").select(ITEM_SPALTEN).eq("plan_id", planId).eq("day_no", tagNr));
  if (!items.ok) return items;
  return { ok: true, daten: alsTage(items.daten ?? [])[0]?.positionen ?? [] };
}

/** Tagnummer des letzten Trainings aus diesem Plan; noch keins → null. */
export async function letzterPlantag(client: Client, planId: string): Promise<Ergebnis<number | null>> {
  const r = await fuehreAus<{ plan_day_no: number | null }[]>(
    client.from("workouts").select("plan_day_no").eq("plan_id", planId).order("started_at", { ascending: false }).limit(1),
  );
  if (!r.ok) return r;
  return { ok: true, daten: r.daten?.[0]?.plan_day_no ?? null };
}

export async function starteWorkoutAusPlan(client: Client, { id, planId, tagNr }: { id?: string; planId: string; tagNr: number }) {
  const userId = await nutzerId(client);
  if (!userId) return { ok: false, fehler: "no_user" } as const;
  return fuehreAus<{ id: string }>(
    client.from("workouts").insert({ ...(id && { id }), user_id: userId, plan_id: planId, plan_day_no: tagNr }).select("id").single(),
  );
}

export const istGueltigePosition = ({ sets, rep_min, rep_max }: Pick<Planposition, "sets" | "rep_min" | "rep_max">) =>
  [sets, rep_min, rep_max].every(Number.isInteger) && sets >= 1 && sets <= 10 && rep_min >= 1 && rep_max <= 100 && rep_min <= rep_max;

// Jede Änderung von Hand macht aus dem Regel-Plan einen eigenen Plan (source = 'manuell').
const markiereManuell = (client: Client, planId: string) =>
  fuehreAus<null>(client.from("training_plans").update({ source: "manuell" }).eq("id", planId));

export async function aenderePosition(
  client: Client,
  planId: string,
  itemId: string,
  werte: Pick<Planposition, "exercise_id" | "sets" | "rep_min" | "rep_max">,
): Promise<Ergebnis<null>> {
  if (!istGueltigePosition(werte)) return { ok: false, fehler: "ungueltig" };
  const { exercise_id, sets, rep_min, rep_max } = werte;
  const r = await fuehreAus<null>(client.from("plan_items").update({ exercise_id, sets, rep_min, rep_max }).eq("id", itemId));
  return r.ok ? markiereManuell(client, planId) : r;
}

export async function entfernePosition(client: Client, planId: string, itemId: string): Promise<Ergebnis<null>> {
  const r = await fuehreAus<null>(client.from("plan_items").delete().eq("id", itemId));
  return r.ok ? markiereManuell(client, planId) : r;
}

// Positionen hängen per on delete cascade am Plan; Trainings bleiben und verlieren nur den Bezug.
export const loeschePlan = (client: Client, planId: string) => fuehreAus<null>(client.from("training_plans").delete().eq("id", planId));
