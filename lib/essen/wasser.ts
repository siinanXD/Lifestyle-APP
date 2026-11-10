import { hatEinwilligung, type Einwilligungszeile } from "../consent/consent";
import type { createClient } from "../supabase/client";
import { fuehreAus, nutzerId, type Ergebnis } from "../training/log";

// Wasser zählt als Gesundheitsdaten (docs/PRIVACY.md, Ernährung & Wasser): Schreiben nur mit offener Einwilligung B.
// Fehler kommen als Ergebnis zurück, nie als Exception. Keine Logausgabe von Mengen.
type Client = ReturnType<typeof createClient>;
export type Wassereintrag = { id: string; amount_ml: number; logged_at: string };

export const MENGE_MIN = 1;
export const MENGE_MAX = 5000;
export const TAGE = 7;

export const istGueltigeMenge = (ml: number) => Number.isInteger(ml) && ml >= MENGE_MIN && ml <= MENGE_MAX;

// Tagesgrenze 00:00 in der Zeitzone des Geräts; läuft deshalb im Browser.
const tagesbeginn = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const gleicherTag = (a: Date, b: Date) => tagesbeginn(a).getTime() === tagesbeginn(b).getTime();

export function tagessumme(eintraege: Pick<Wassereintrag, "amount_ml" | "logged_at">[], tag: Date) {
  return eintraege.filter((e) => gleicherTag(new Date(e.logged_at), tag)).reduce((s, e) => s + e.amount_ml, 0);
}

/** Die letzten 7 Tage bis einschließlich `jetzt`, ältester zuerst. */
export function letzteTage(eintraege: Pick<Wassereintrag, "amount_ml" | "logged_at">[], jetzt: Date) {
  return Array.from({ length: TAGE }, (_, i) => {
    const tag = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() - (TAGE - 1 - i));
    return { tag, summe: tagessumme(eintraege, tag) };
  });
}

export async function trageWasserEin(client: Client, ml: number): Promise<Ergebnis<Wassereintrag>> {
  if (!istGueltigeMenge(ml)) return { ok: false, fehler: "ungueltig" };
  const userId = await nutzerId(client);
  if (!userId) return { ok: false, fehler: "no_user" };
  // Die Datenbank prüft B bei water_logs nicht selbst (anders als bei health_profile/workouts), daher hier.
  const einwilligung = await fuehreAus<Einwilligungszeile[]>(client.from("consents").select("kind, revoked_at").eq("kind", "B"));
  if (!einwilligung.ok) return einwilligung;
  if (!hatEinwilligung(einwilligung.daten, "B")) return { ok: false, fehler: "keine_einwilligung" };
  return fuehreAus<Wassereintrag>(
    client.from("water_logs").insert({ user_id: userId, amount_ml: ml }).select("id, amount_ml, logged_at").single(),
  );
}

export function loescheWasser(client: Client, id: string) {
  return fuehreAus<null>(client.from("water_logs").delete().eq("id", id));
}

// 8 statt 7 Tage: Die Tagesgrenze liegt in der Zeitzone des Geräts, der Server kennt sie nicht. Zuschnitt im Browser.
export const ladebeginn = (jetzt = new Date()) => new Date(jetzt.getTime() - (TAGE + 1) * 24 * 60 * 60 * 1000).toISOString();

export function wasserSeit(client: Client, seitIso: string) {
  return fuehreAus<Wassereintrag[]>(
    client.from("water_logs").select("id, amount_ml, logged_at").gte("logged_at", seitIso).order("logged_at", { ascending: false }),
  );
}
