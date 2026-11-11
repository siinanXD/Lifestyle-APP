import { hatEinwilligung, type Einwilligungszeile } from "../consent/consent";
import type { createClient } from "../supabase/client";
import { bewerteComeback, type Befinden, type Comeback } from "./comeback";
import { fuehreAus, nutzerId, type Ergebnis } from "./log";

// Smart Comeback im Ablauf (SIN-1281): Pause erkennen, freiwillig fragen, Einstieg anpassen. Ton: ruhig, ohne Schuld.
type Client = ReturnType<typeof createClient>;

export const COMEBACK_AB_TAGEN = 14;
// Schlüssel wie die Checks in lifestyle.comeback_checkins.
export const GRUENDE = {
  urlaub: "Urlaub",
  krank_oder_verletzt: "Krank oder verletzt",
  stress: "Stress",
  keine_lust: "Keine Lust",
  anderes: "Anderes",
} as const;
export type Grund = keyof typeof GRUENDE;
export const BEFINDEN: Record<Befinden, string> = { gut: "Gut", mittel: "Mittel", schlecht: "Schlecht" };

export const TEXTE = {
  titel: "Schön, dass du wieder da bist.",
  einleitung: "Magst du kurz sagen, wie es dir geht? Beides ist freiwillig.",
  grund: "Was war los?",
  befinden: "Wie fühlst du dich heute?",
  aerztlich: "Wenn du dich nicht fit fühlst, frag bitte ärztlichen Rat.",
  normal: "Du kannst wie gewohnt weitermachen.",
} as const;

const prozent = (faktor: number) => Math.round((1 - faktor) * 100);

/** Ein Satz dazu, was sich ändert. Die Werte kommen aus `bewerteComeback`, nicht doppelt von Hand. */
export function aenderungText(c: Comeback): string {
  if (c.stufe === 0) return TEXTE.normal;
  const teile = [`${prozent(c.gewichtFaktor)} % weniger Gewicht`, ...(c.satzAbzug > 0 ? [c.satzAbzug === 1 ? "ein Satz weniger" : `${c.satzAbzug} Sätze weniger`] : [])];
  return `Wir starten etwas leichter: ${teile.join(", ")}.`;
}

// Die Rückkehr gilt, bis das nächste Training beendet ist. Gemerkt wird nur auf dem Gerät; die Zeile in comeback_checkins
// ist der Nachweis der freiwilligen Angabe. localStorage kann fehlen oder werfen, dann gilt die Stufe nur für diese Seite.
const SCHLUESSEL = "lifestyle.comeback";
export type Gemerkt = { tage: number; befinden?: Befinden };

export function merkeComeback(g: Gemerkt) {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(g));
  } catch {
    // ohne Speicher gilt die Stufe nur bis zum Neuladen
  }
}

export function gemerktesComeback(): Comeback | null {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    if (!roh) return null;
    const g = JSON.parse(roh) as Gemerkt;
    return bewerteComeback(g.tage, g.befinden);
  } catch {
    return null;
  }
}

export function vergissComeback() {
  try {
    localStorage.removeItem(SCHLUESSEL);
  } catch {
    // nichts zu tun
  }
}

/**
 * Speichert die freiwillige Angabe nur mit offener Einwilligung B. Ohne B: nichts speichern, kein Fehler
 * (`gespeichert: false`); die Stufe nach Tagen gilt trotzdem.
 */
export async function speichereCheckin(
  client: Client,
  { tage, grund, befinden, stufe }: { tage: number; grund?: Grund; befinden?: Befinden; stufe: Comeback["stufe"] },
): Promise<Ergebnis<{ gespeichert: boolean }>> {
  const userId = await nutzerId(client);
  if (!userId) return { ok: false, fehler: "no_user" };
  const einwilligung = await fuehreAus<Einwilligungszeile[]>(client.from("consents").select("kind, revoked_at").eq("kind", "B"));
  if (!einwilligung.ok) return einwilligung;
  if (!hatEinwilligung(einwilligung.daten ?? [], "B")) return { ok: true, daten: { gespeichert: false } };
  const r = await fuehreAus<null>(
    client
      .from("comeback_checkins")
      .insert({ user_id: userId, days_since_last: Math.min(tage, 3650), reason: grund ?? null, feeling: befinden ?? null, level: stufe }),
  );
  return r.ok ? { ok: true, daten: { gespeichert: true } } : r;
}
